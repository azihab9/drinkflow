const SUPABASE_URL = "https://rjmcjdvxfdpoiaojtsbm.supabase.co";
const SUPABASE_KEY = "sb_publishable_s3tW5464tBsxroLNt755VA__ylslnOD";

const products = [
  ["MTC001","Matcha Original",15000],["MTC002","Strawberry Matcha Cream",19000],
  ["MTC003","Ube Matcha Cream",19000],["MTC004","Honey Matcha",18000],
  ["MTC005","Matcha Cloud",18000],["MTC006","Matcha Cookies",19000],
  ["MTC007","Coklat Matcha",19000],["MTC008","Matcha Yakult",19000],
  ["MTC009","Matcha Oreo",19000],["MTC010","Matcha Coconut",19000],
  ["MTC011","Matcha Caramel",19000]
];
const money = value => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value||0);

const popular = document.querySelector("#popularProducts");
if(popular) popular.innerHTML = products.slice(0,6).map(([sku,name,price]) =>
  `<div class="product-item"><span>${name}</span><span>${money(price)}</span></div>`).join("");

const dateLabel=document.querySelector("#todayLabel");
if(dateLabel) dateLabel.textContent=new Intl.DateTimeFormat("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Jakarta"}).format(new Date());
document.querySelector("#year").textContent=new Date().getFullYear();

const labels={overview:"Overview",pos:"Point of Sale",orders:"Orders",products:"Products",inventory:"Inventory",purchasing:"Purchasing",expenses:"Expenses",finance:"Finance",reports:"Reports",settings:"Settings"};
function notify(message){
 const toast=document.querySelector("#toast");toast.textContent=message;toast.classList.add("show");
 window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>toast.classList.remove("show"),3000);
}

async function loadProducts(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">PRODUCT CATALOG</div><h1>Products</h1><p>Daftar produk MATCHABOY PASID dari database.</p></div></div><div class="panel"><p>Memuat produk dari Supabase...</p></div>';
 try{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.asc`,{
   headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data.message||data.details||"Gagal mengambil data produk");
  if(!Array.isArray(data)) throw new Error("Format data produk tidak dikenali");
  const rows=data.map((p)=>{
   const name=p.name||p.product_name||p.title||"Produk tanpa nama";
   const sku=p.sku||p.code||"-";
   const status=p.is_active===false||p.active===false?"Nonaktif":"Aktif";
   return `<tr><td>${String(sku)}</td><td><strong>${String(name)}</strong></td><td><span class="product-status">${status}</span></td></tr>`;
  }).join("");
  page.innerHTML=`<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Products</h1><p>${data.length} produk ditemukan dari Supabase.</p></div><button class="primary-button" id="refreshProducts">↻ Refresh</button></div><div class="panel"><div class="panel-heading"><div><h2>Product catalog</h2><p>Data langsung dari database DrinkFlow</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>SKU</th><th>Nama produk</th><th>Status</th></tr></thead><tbody>${rows||'<tr><td colspan="3">Belum ada produk.</td></tr>'}</tbody></table></div></div>`;
  document.querySelector("#refreshProducts").addEventListener("click",loadProducts);
 }catch(error){
  page.innerHTML=`<div class="welcome-row"><div><div class="eyebrow">PRODUCT CATALOG</div><h1>Products</h1><p>Koneksi database belum berhasil.</p></div></div><div class="panel"><h2>Belum bisa memuat produk</h2><p>${String(error.message)}</p><p class="muted">Periksa tabel products, izin RLS, dan konfigurasi API Supabase.</p><button class="secondary-button" id="retryProducts">Coba lagi</button></div>`;
  document.querySelector("#retryProducts").addEventListener("click",loadProducts);
 }
}
function navigate(view){
 document.querySelector("#breadcrumbTitle").textContent=labels[view]||"Overview";
 document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));
 document.querySelector("#sidebar").classList.remove("open");
 if(view==="products"){loadProducts();return;}
 if(view!=="overview"){notify((labels[view]||view)+" module is being prepared.");return;}
 window.location.reload();
}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.view)));
document.querySelector("#mobileMenu").addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
