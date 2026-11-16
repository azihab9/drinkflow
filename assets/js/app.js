const SUPABASE_URL="https://rjmcjdvxfdpoiaojtsbm.supabase.co";
const SUPABASE_KEY="sb_publishable_s3tW5464tBsxroLNt755VA__ylslnOD";
const authGate=document.querySelector("#authGate"),appShell=document.querySelector("#appShell"),authMessage=document.querySelector("#authMessage");
let supabaseClient=null;
function authStatus(message,isError=true){if(authMessage){authMessage.textContent=message;authMessage.style.color=isError?"#a14e42":"#64836b";}}
function initSupabase(){
 if(!window.supabase?.createClient){authStatus("Komponen login gagal dimuat. Muat ulang halaman dengan Ctrl + Shift + R.");return false;}
 try{supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);return true;}
 catch(error){authStatus("Gagal menyiapkan koneksi: "+error.message);return false;}
}
const money=value=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value||0);
const dateLabel=document.querySelector("#todayLabel");
if(dateLabel)dateLabel.textContent=new Intl.DateTimeFormat("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Jakarta"}).format(new Date());
document.querySelector("#year").textContent=new Date().getFullYear();
function showApp(profile,user){
 authGate.hidden=true;appShell.hidden=false;
 const display=profile?.full_name||user.email?.split("@")[0]||"User";
 document.querySelector(".user-mini b").textContent=display;
 document.querySelector(".user-mini small").textContent=profile?.role==="owner"?"Owner account":"Cashier account";
 document.querySelector("#topAvatar").textContent=display.slice(0,1).toUpperCase();
}
async function checkSession(){
 try{
  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error)throw error;
  if(!session){appShell.hidden=true;authGate.hidden=false;return;}
  const {data:profile,error:profileError}=await supabaseClient.from("profiles").select("full_name,role,is_active").eq("id",session.user.id).single();
  if(profileError||!profile||!profile.is_active){await supabaseClient.auth.signOut();authStatus("Profil belum aktif atau tidak ditemukan. Hubungi Owner.");appShell.hidden=true;authGate.hidden=false;return;}
  showApp(profile,session.user);
 }catch(error){appShell.hidden=true;authGate.hidden=false;authStatus("Gagal memeriksa sesi: "+(error.message||"Periksa koneksi internet."));}
}
document.querySelector("#loginForm").addEventListener("submit",async event=>{
 event.preventDefault();
 const submit=event.currentTarget.querySelector('button[type="submit"]');
 submit.disabled=true;submit.textContent="Memproses...";
 authStatus("Menghubungkan ke akun...",false);
 try{
  if(!supabaseClient)throw new Error("Koneksi Supabase belum siap. Muat ulang halaman.");
  const email=document.querySelector("#loginEmail").value.trim(),password=document.querySelector("#loginPassword").value;
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error)throw error;
  const {data:profile,error:profileError}=await supabaseClient.from("profiles").select("full_name,role,is_active").eq("id",data.user.id).single();
  if(profileError)throw profileError;
  if(!profile||!profile.is_active){await supabaseClient.auth.signOut();throw new Error("Profil tidak aktif atau tidak ditemukan. Hubungi Owner.");}
  authStatus("",false);showApp(profile,data.user);
 }catch(error){authStatus("Login gagal: "+(error.message||"Terjadi kesalahan. Coba lagi."));}
 finally{submit.disabled=false;submit.textContent="Masuk";}
});
document.querySelector("#logoutButton").addEventListener("click",async()=>{await supabaseClient.auth.signOut();appShell.hidden=true;authGate.hidden=false;});
supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){appShell.hidden=true;authGate.hidden=false;}});
const labels={overview:"Overview",pos:"Point of Sale",orders:"Orders",products:"Products",inventory:"Inventory",purchasing:"Purchasing",expenses:"Expenses",finance:"Finance",reports:"Reports",settings:"Settings"};
function notify(message){const toast=document.querySelector("#toast");toast.textContent=message;toast.classList.add("show");window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>toast.classList.remove("show"),2800);}
async function loadProducts(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">PRODUCT CATALOG</div><h1>Products</h1><p>Memuat data katalog...</p></div></div><div class="panel">Mengambil data dari Supabase...</div>';
 const {data,error}=await supabaseClient.from("products").select("*").order("created_at",{ascending:true});
 if(error){page.innerHTML='<div class="panel"><h2>Gagal memuat produk</h2><p>'+error.message+'</p><button class="secondary-button" id="retryProducts">Coba lagi</button></div>';document.querySelector("#retryProducts").addEventListener("click",loadProducts);return;}
 const rows=(data||[]).map(p=>'<tr><td>'+String(p.sku||"-")+'</td><td><strong>'+String(p.name||"Produk")+'</strong></td><td><span class="product-status">'+(p.is_active===false?"Nonaktif":"Aktif")+'</span></td></tr>').join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Products</h1><p>'+(data||[]).length+' produk ditemukan dari Supabase.</p></div><button class="primary-button" id="refreshProducts">↻ Refresh</button></div><div class="panel"><div class="panel-heading"><div><h2>Product catalog</h2><p>Data langsung dari database DrinkFlow</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Nama produk</th><th>Status</th></tr></thead><tbody>'+(rows||'<tr><td colspan="3">Belum ada produk.</td></tr>')+'</tbody></table></div></div>';
 document.querySelector("#refreshProducts").addEventListener("click",loadProducts);
}
function navigate(view){document.querySelector("#breadcrumbTitle").textContent=labels[view]||"Overview";document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));document.querySelector("#sidebar").classList.remove("open");if(view==="products"){loadProducts();return;}if(view!=="overview"){notify((labels[view]||view)+" module sedang disiapkan.");return;}window.location.reload();}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.view)));
document.querySelector("#mobileMenu").addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
if(initSupabase())checkSession();
