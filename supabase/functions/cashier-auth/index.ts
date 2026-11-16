import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function ownerFromRequest(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sesi Owner diperlukan.");
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error("Sesi tidak valid. Silakan login ulang.");
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,full_name,role,is_active").eq("id", user.id).single();
  if (profileError || !profile?.is_active || profile.role !== "owner") throw new Error("Akses hanya untuk Owner.");
  return user;
}

function validPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^[0-9]{6}$/.test(pin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method tidak didukung." });
  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "login") {
      const code = String(body.cashier_code || "").trim().toUpperCase();
      const pin = body.pin;
      if (!/^KSR[0-9]{3,8}$/.test(code) || !validPin(pin)) {
        return json(400, { error: "ID Kasir atau PIN tidak valid." });
      }
      const { data: access, error } = await admin.from("cashier_access")
        .select("user_id,cashier_code,pin_hash,is_active,failed_attempts,locked_until")
        .eq("cashier_code", code).maybeSingle();
      if (error || !access || !access.is_active) return json(401, { error: "ID Kasir atau PIN salah." });
      if (access.locked_until && new Date(access.locked_until).getTime() > Date.now()) {
        return json(429, { error: "Terlalu banyak percobaan. Coba lagi 15 menit." });
      }
      const valid = await bcrypt.compare(pin, access.pin_hash);
      if (!valid) {
        const attempts = Number(access.failed_attempts || 0) + 1;
        await admin.from("cashier_access").update({
          failed_attempts: attempts >= 5 ? 0 : attempts,
          locked_until: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", access.user_id);
        return json(401, { error: "ID Kasir atau PIN salah." });
      }
      await admin.from("cashier_access").update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq("user_id", access.user_id);
      const { data: profile, error: profileError } = await admin.from("profiles")
        .select("id,full_name,role,is_active").eq("id", access.user_id).single();
      if (profileError || !profile?.is_active || profile.role !== "cashier") {
        return json(403, { error: "Akun kasir tidak aktif. Hubungi Owner." });
      }
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: `cashier+${code.toLowerCase()}@drinkflow.invalid`,
      });
      if (linkError || !link?.properties?.hashed_token) throw new Error("Tidak dapat membuat sesi kasir.");
      const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: sessionData, error: verifyError } = await publicClient.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: "magiclink",
      });
      if (verifyError || !sessionData.session) throw new Error("Gagal membuat sesi login kasir.");
      return json(200, { session: sessionData.session, user: sessionData.user, profile });
    }

    await ownerFromRequest(req);

    if (action === "create") {
      const fullName = String(body.full_name || "").trim();
      const code = String(body.cashier_code || "").trim().toUpperCase();
      const pin = body.pin;
      if (fullName.length < 2 || fullName.length > 80) return json(400, { error: "Nama kasir harus 2–80 karakter." });
      if (!/^KSR[0-9]{3,8}$/.test(code)) return json(400, { error: "ID Kasir harus berformat KSR001." });
      if (!validPin(pin)) return json(400, { error: "PIN harus tepat 6 digit." });
      const email = `cashier+${code.toLowerCase()}@drinkflow.invalid`;
      const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password: randomPassword, email_confirm: true,
        user_metadata: { full_name: fullName, account_type: "cashier" },
      });
      if (createError || !created.user) throw new Error(createError?.message || "Gagal membuat akun kasir.");
      const pinHash = await bcrypt.hash(pin, 12);
      const { error: profileError } = await admin.from("profiles").upsert({
        id: created.user.id, full_name: fullName, role: "cashier", is_active: true,
      }, { onConflict: "id" });
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw new Error("Gagal membuat profil: " + profileError.message);
      }
      const { error: accessError } = await admin.from("cashier_access").insert({
        user_id: created.user.id, cashier_code: code, pin_hash: pinHash, is_active: true,
      });
      if (accessError) {
        await admin.from("profiles").delete().eq("id", created.user.id);
        await admin.auth.admin.deleteUser(created.user.id);
        throw new Error("Gagal menyimpan akses kasir: " + accessError.message);
      }
      return json(200, { success: true, cashier_code: code, full_name: fullName });
    }

    if (action === "list") {
      const { data, error } = await admin.from("cashier_access")
        .select("cashier_code,user_id,is_active,created_at,profiles(full_name)")
        .order("cashier_code");
      if (error) throw error;
      return json(200, { cashiers: data || [] });
    }

    if (action === "set_active") {
      const code = String(body.cashier_code || "").trim().toUpperCase();
      if (typeof body.is_active !== "boolean") return json(400, { error: "Status tidak valid." });
      const { error } = await admin.from("cashier_access").update({ is_active: body.is_active, updated_at: new Date().toISOString() }).eq("cashier_code", code);
      if (error) throw error;
      const { data: row } = await admin.from("cashier_access").select("user_id").eq("cashier_code", code).single();
      if (row) await admin.from("profiles").update({ is_active: body.is_active }).eq("id", row.user_id);
      return json(200, { success: true });
    }

    return json(400, { error: "Aksi tidak dikenal." });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : "Permintaan gagal." });
  }
});
