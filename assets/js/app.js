const SUPABASE_URL="https://rjmcjdvxfdpoiaojtsbm.supabase.co";
const SUPABASE_KEY="sb_publishable_s3tW5464tBsxroLNt755VA__ylslnOD";
const supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const authGate=document.querySelector("#authGate"),appShell=document.querySelector("#appShell"),authMessage=document.querySelector("#authMessage");
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
 const {data:{session}}=await supabase.auth.getSession();
 if(!session){appShell.hidden=true;authGate.hidden=false;return;}
 const {data:profile,error}=await supabase.from("profiles").select("full_name,role,is_active").eq("id",session.user.id).single();
 if(error||!profile||!profile.is_active){await supabase.auth.signOut();authMessage.textContent="Akun belum aktif atau profil tidak ditemukan.";appShell.hidden=true;authGate.hidden=false;return;}
 showApp(profile,session.user);
}
document.querySelector("#loginForm").addEventListener("submit",async event=>{
 event.preventDefault();authMessage.textContent="Memeriksa akun...";
 const email=document.querySelector("#loginEmail").value.trim(),password=document.querySelector("#loginPassword").value;
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error){authMessage.textContent="Login gagal: "+error.message;return;}
 const {data:profile,error:profileError}=await supabase.from("profiles").select("full_name,role,is_active").eq("id",data.user.id).single();
 if(profileError||!profile||!profile.is_active){await supabase.auth.signOut();authMessage.textContent="Profil tidak aktif atau tidak ditemukan. Hubungi Owner.";return;}
 authMessage.textContent="";showApp(profile,data.user);
});
document.querySelector("#logoutButton").addEventListener("click",async()=>{await supabase.auth.signOut();appShell.hidden=true;authGate.hidden=false;});
supabase.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){appShell.hidden=true;authGate.hidden=false;}});
const labels={overview:"Overview",pos:"Point of Sale",orders:"Orders",products:"Products",inventory:"Inventory",purchasing:"Purchasing",expenses:"Expenses",finance:"Finance",reports:"Reports",settings:"Settings"};
function notify(message){const toast=document.querySelector("#toast");toast.textContent=message;toast.classList.add("show");window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>toast.classList.remove("show"),2800);}
async function loadProducts(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">PRODUCT CATALOG</div><h1>Products</h1><p>Memuat data katalog...</p></div></div><div class="panel">Mengambil data dari Supabase...</div>';
 const {data,error}=await supabase.from("products").select("*").order("created_at",{ascending:true});
 if(error){page.innerHTML='<div class="panel"><h2>Gagal memuat produk</h2><p>'+error.message+'</p><button class="secondary-button" id="retryProducts">Coba lagi</button></div>';document.querySelector("#retryProducts").addEventListener("click",loadProducts);return;}
 const rows=(data||[]).map(p=>'<tr><td>'+String(p.sku||"-")+'</td><td><strong>'+String(p.name||"Produk")+'</strong></td><td><span class="product-status">'+(p.is_active===false?"Nonaktif":"Aktif")+'</span></td></tr>').join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Products</h1><p>'+(data||[]).length+' produk ditemukan dari Supabase.</p></div><button class="primary-button" id="refreshProducts">↻ Refresh</button></div><div class="panel"><div class="panel-heading"><div><h2>Product catalog</h2><p>Data langsung dari database DrinkFlow</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Nama produk</th><th>Status</th></tr></thead><tbody>'+(rows||'<tr><td colspan="3">Belum ada produk.</td></tr>')+'</tbody></table></div></div>';
 document.querySelector("#refreshProducts").addEventListener("click",loadProducts);
}
function navigate(view){document.querySelector("#breadcrumbTitle").textContent=labels[view]||"Overview";document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));document.querySelector("#sidebar").classList.remove("open");if(view==="products"){loadProducts();return;}if(view!=="overview"){notify((labels[view]||view)+" module sedang disiapkan.");return;}window.location.reload();}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.view)));
document.querySelector("#mobileMenu").addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
checkSession();
