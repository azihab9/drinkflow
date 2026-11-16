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

const labels={overview:"Overview",pos:"Point of Sale",orders:"Orders",products:"Products",inventory:"Inventory",purchasing:"Purchasing",expenses:"Expenses",finance:"Finance",reports:"Reports",settings:"Settings"};
function notify(message){const toast=document.querySelector("#toast");toast.textContent=message;toast.classList.add("show");window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>toast.classList.remove("show"),2800);}
async function loadProducts(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Products</h1><p>Memuat katalog produk...</p></div></div><div class="panel">Mengambil data dari Supabase...</div>';
 const [{data:products,error:productError},{data:channels,error:channelError}]=await Promise.all([
  supabaseClient.from("products").select("*").order("created_at",{ascending:true}),
  supabaseClient.from("sales_channels").select("id,code,name,commission_rate,is_active").eq("is_active",true).order("name")
 ]);
 if(productError||channelError){
  page.innerHTML='<div class="panel"><h2>Gagal memuat katalog</h2><p>'+String(productError?.message||channelError?.message)+'</p><button class="secondary-button" id="retryProducts">Coba lagi</button></div>';
  document.querySelector("#retryProducts").addEventListener("click",loadProducts);return;
 }
 const {data:prices,error:priceError}=await supabaseClient.from("product_channel_prices").select("product_id,channel_id,price");
 if(priceError){page.innerHTML='<div class="panel"><h2>Gagal memuat harga channel</h2><p>'+priceError.message+'</p></div>';return;}
 const priceMap=new Map((prices||[]).map(x=>[x.product_id+"_"+x.channel_id,x.price]));
 const channelNames=(channels||[]).map(c=>c.name).join(" · ");
 const rows=(products||[]).map(p=>{
  const pPrices=(channels||[]).map(c=>{const raw=priceMap.get(p.id+"_"+c.id);const rate=Number(c.commission_rate||0);return '<span class="price-chip"><b>'+escapeHtml(c.name)+'</b><strong>'+(raw===undefined?'Belum diatur':money(raw))+'</strong><small>Komisi '+rate+'%</small></span>';}).join("");
  return '<tr><td>'+escapeHtml(p.sku)+'</td><td><strong>'+escapeHtml(p.name)+'</strong><small class="table-sub">'+escapeHtml(p.unit||"cup")+'</small></td><td>'+pPrices+'</td><td><span class="product-status '+(p.is_active===false?"inactive":"")+'">'+(p.is_active===false?"Nonaktif":"Aktif")+'</span></td><td><button class="table-action" data-edit-product="'+p.id+'">Edit</button></td></tr>';
 }).join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Products</h1><p>'+(products||[]).length+' produk · Harga per channel penjualan</p></div><button class="primary-button" id="addProduct">＋ Tambah produk</button></div><div class="panel"><div class="panel-heading"><div><h2>Product catalog</h2><p>Data langsung dari database DrinkFlow</p></div><button class="text-button" id="refreshProducts">↻ Refresh</button></div><div class="table-wrap"><table class="data-table product-table"><thead><tr><th>SKU</th><th>Nama produk</th><th>Harga channel</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">Belum ada produk.</td></tr>')+'</tbody></table></div></div><div id="productEditor"></div>';
 document.querySelector("#addProduct").addEventListener("click",()=>openProductEditor(null,channels,priceMap));
 document.querySelector("#refreshProducts").addEventListener("click",loadProducts);
 document.querySelectorAll("[data-edit-product]").forEach(btn=>btn.addEventListener("click",()=>openProductEditor(products.find(p=>p.id===btn.dataset.editProduct),channels,priceMap)));
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function openProductEditor(product,channels,priceMap){
 const host=document.querySelector("#productEditor"),editing=!!product;
 const prices=(channels||[]).map(c=>{
  const value=editing?(priceMap.get(product.id+"_"+c.id)??""):"";
  return '<label class="price-field"><span>'+escapeHtml(c.name)+'</span><input type="number" min="0" step="500" name="price_'+c.id+'" placeholder="Harga Rp" value="'+value+'"></label>';
 }).join("");
 host.innerHTML='<div class="editor-backdrop"><form class="product-editor" id="productForm"><div class="editor-heading"><div><div class="eyebrow">PRODUCT MANAGEMENT</div><h2>'+(editing?"Edit produk":"Tambah produk")+'</h2><p>Isi informasi produk dan harga setiap channel.</p></div><button type="button" class="icon-close" id="closeEditor">×</button></div><div class="form-grid"><label>SKU<input name="sku" required maxlength="30" value="'+escapeHtml(product?.sku||"")+'" placeholder="MTC012"></label><label>Nama produk<input name="name" required value="'+escapeHtml(product?.name||"")+'" placeholder="Nama minuman"></label><label>Satuan<input name="unit" required value="'+escapeHtml(product?.unit||"cup")+'" placeholder="cup"></label><label class="wide-field">Deskripsi<textarea name="description" rows="2" placeholder="Deskripsi singkat (opsional)">'+escapeHtml(product?.description||"")+'</textarea></label></div><div class="price-section"><h3>Harga jual per channel</h3><div class="price-grid">'+prices+'</div></div>'+(editing?'<label class="active-toggle"><input type="checkbox" name="is_active" '+(product.is_active===false?"":"checked")+'> Produk aktif dan dapat dijual</label>':'')+'<div class="editor-actions"><button type="button" class="secondary-button" id="cancelEditor">Batal</button><button type="submit" class="primary-button" id="saveProduct">Simpan produk</button></div><p class="editor-message" id="editorMessage"></p></form></div>';
 const close=()=>{host.innerHTML="";};
 document.querySelector("#closeEditor").addEventListener("click",close);
 document.querySelector("#cancelEditor").addEventListener("click",close);
 document.querySelector("#productForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=document.querySelector("#saveProduct"),message=document.querySelector("#editorMessage");
  button.disabled=true;button.textContent="Menyimpan...";
  try{
   const fd=new FormData(form),payload={sku:String(fd.get("sku")).trim(),name:String(fd.get("name")).trim(),unit:String(fd.get("unit")).trim(),description:String(fd.get("description")||"").trim()||null,updated_at:new Date().toISOString()};
   if(editing)payload.is_active=fd.get("is_active")==="on";
   let saved;
   if(editing){
    const result=await supabaseClient.from("products").update(payload).eq("id",product.id).select("id").single();
    if(result.error)throw result.error;saved=result.data;
   }else{
    const result=await supabaseClient.from("products").insert(payload).select("id").single();
    if(result.error)throw result.error;saved=result.data;
   }
   for(const channel of channels){
    const raw=String(fd.get("price_"+channel.id)||"").trim();
    if(!raw)continue;
    const numeric=Number(raw);
    if(!Number.isFinite(numeric)||numeric<0)throw new Error("Harga "+channel.name+" tidak valid.");
    const {data:existing,error:findError}=await supabaseClient.from("product_channel_prices").select("id").eq("product_id",saved.id).eq("channel_id",channel.id).maybeSingle();
    if(findError)throw findError;
    const result=existing
     ?await supabaseClient.from("product_channel_prices").update({price:numeric}).eq("id",existing.id)
     :await supabaseClient.from("product_channel_prices").insert({product_id:saved.id,channel_id:channel.id,price:numeric});
    if(result.error)throw result.error;
   }
   host.innerHTML="";notify(editing?"Produk berhasil diperbarui.":"Produk berhasil ditambahkan.");await loadProducts();
  }catch(error){message.textContent="Gagal menyimpan: "+error.message;button.disabled=false;button.textContent="Simpan produk";}
 });
}

function navigate(view){document.querySelector("#breadcrumbTitle").textContent=labels[view]||"Overview";document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));document.querySelector("#sidebar").classList.remove("open");if(view==="products"){loadProducts();return;}if(view!=="overview"){notify((labels[view]||view)+" module sedang disiapkan.");return;}window.location.reload();}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.view)));
document.querySelector("#mobileMenu").addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
if(initSupabase()){
 supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){appShell.hidden=true;authGate.hidden=false;}});
 checkSession();
}
