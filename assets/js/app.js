const SUPABASE_URL="https://rjmcjdvxfdpoiaojtsbm.supabase.co";
const SUPABASE_KEY="sb_publishable_s3tW5464tBsxroLNt755VA__ylslnOD";
const authGate=document.querySelector("#authGate"),appShell=document.querySelector("#appShell"),authMessage=document.querySelector("#authMessage");
let supabaseClient=null,currentRole='cashier';
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
 currentRole=profile?.role||'cashier';
 authGate.hidden=true;appShell.hidden=false;
 const display=profile?.full_name||user.email?.split("@")[0]||"User";
 document.querySelector(".user-mini b").textContent=display;
 document.querySelector(".user-mini small").textContent=profile?.role==="owner"?"Owner account":"Cashier account";
 document.querySelector("#topAvatar").textContent=display.slice(0,1).toUpperCase();
 let savedView="overview";
 try{
  const candidate=sessionStorage.getItem("drinkflow:lastView");
  if(candidate&&Object.prototype.hasOwnProperty.call(labels,candidate))savedView=candidate;
 }catch(error){}
 navigate(savedView);
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
document.querySelector("#logoutButton").addEventListener("click",async()=>{try{sessionStorage.removeItem("drinkflow:lastView");}catch(error){}await supabaseClient.auth.signOut();appShell.hidden=true;authGate.hidden=false;});

const labels={overview:"Overview",pos:"Point of Sale",orders:"Orders",products:"Products",inventory:"Inventory",purchasing:"Purchasing",expenses:"Expenses",finance:"Finance",reports:"Reports",costRecipe:"Cost & Recipe",settings:"Settings"};
function notify(message){const toast=document.querySelector("#toast");toast.textContent=message;toast.classList.add("show");window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>toast.classList.remove("show"),2800);}

function dfDayOffset(offset){const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return new Date(Date.UTC(+p.year,+p.month-1,+p.day+offset)).toISOString().slice(0,10);}
function dfStart(offset){return dfDayOffset(offset)+"T00:00:00+07:00";}
async function loadOverview(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Overview</h1><p>Ringkasan berdasarkan transaksi yang sudah selesai.</p></div><button class="secondary-button" id="refreshOverview">↻ Refresh</button></div><div class="panel">Memuat ringkasan...</div>';
 const [t,w,p,ch,pend]=await Promise.all([
  supabaseClient.from("orders").select("id,total_amount,net_amount,channel_id,ordered_at").eq("order_status","completed").gte("ordered_at",dfStart(0)).lt("ordered_at",dfStart(1)),
  supabaseClient.from("orders").select("id,total_amount,ordered_at").eq("order_status","completed").gte("ordered_at",dfStart(-6)).lt("ordered_at",dfStart(1)),
  supabaseClient.from("products").select("id",{count:"exact",head:true}).eq("is_active",true),
  supabaseClient.from("sales_channels").select("id,name").eq("is_active",true),
  supabaseClient.from("orders").select("id",{count:"exact",head:true}).eq("order_status","pending")
 ]);
 const err=[t,w,p,ch,pend].find(x=>x.error);
 if(err){page.innerHTML='<div class="panel"><h2>Gagal memuat Overview</h2><p>'+escapeHtml(err.error.message)+'</p><button class="secondary-button" id="retryOverview">Coba lagi</button></div>';document.querySelector("#retryOverview").onclick=loadOverview;return;}
 const today=t.data||[],week=w.data||[],sum=(a,k)=>a.reduce((n,x)=>n+Number(x[k]||0),0);
 const channelRows=(ch.data||[]).map(x=>'<div class="channel-row"><span class="channel-badge">'+escapeHtml(x.name.slice(0,2).toUpperCase())+'</span><span><b>'+escapeHtml(x.name)+'</b><small>Omzet completed hari ini</small></span><strong>'+money(sum(today.filter(o=>o.channel_id===x.id),"total_amount"))+'</strong></div>').join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Overview</h1><p>Ringkasan berdasarkan transaksi yang sudah selesai.</p></div><button class="secondary-button" id="refreshOverview">↻ Refresh</button></div><div class="metric-grid"><article class="metric-card"><div class="metric-top"><span>Omzet hari ini</span></div><strong>'+money(sum(today,"total_amount"))+'</strong><small class="muted">Transaksi completed saja</small></article><article class="metric-card"><div class="metric-top"><span>Transaksi hari ini</span></div><strong>'+today.length+'</strong><small class="muted">'+(pend.count||0)+' pending seluruh periode</small></article><article class="metric-card"><div class="metric-top"><span>Estimasi diterima</span></div><strong>'+money(sum(today,"net_amount"))+'</strong><small class="muted">Setelah komisi platform</small></article><article class="metric-card"><div class="metric-top"><span>Produk aktif</span></div><strong>'+(p.count||0)+'</strong><small class="positive">Katalog aktif</small></article></div><div class="content-grid"><article class="panel"><div class="panel-heading"><div><h2>Performa 7 hari</h2><p>Omzet transaksi completed</p></div></div><div class="overview-week"><strong>'+money(sum(week,"total_amount"))+'</strong><small>'+week.length+' transaksi selesai</small></div><p class="overview-note">Pending dan cancelled tidak dihitung sebagai omzet.</p></article><article class="panel"><div class="panel-heading"><div><h2>Sales channels</h2><p>Omzet hari ini</p></div></div>'+channelRows+'</article></div><div class="panel"><h2>Catatan profit</h2><p class="overview-note">Laba belum dihitung karena HPP resep dan biaya operasional belum lengkap. Estimasi diterima bukan laba bersih.</p></div>';
 document.querySelector("#refreshOverview").onclick=loadOverview;
}
async function loadReports(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Reports</h1><p>Laporan 7 hari terakhir · transaksi completed saja.</p></div><button class="secondary-button" id="refreshReports">↻ Refresh</button></div><div class="panel">Memuat laporan...</div>';
 const [o,ch]=await Promise.all([
  supabaseClient.from("orders").select("id,total_amount,platform_fee,net_amount,channel_id,ordered_at").eq("order_status","completed").gte("ordered_at",dfStart(-6)).lt("ordered_at",dfStart(1)).order("ordered_at",{ascending:true}),
  supabaseClient.from("sales_channels").select("id,name").eq("is_active",true)
 ]);
 if(o.error||ch.error){page.innerHTML='<div class="panel"><h2>Gagal memuat laporan</h2><p>'+escapeHtml(o.error?.message||ch.error?.message)+'</p><button class="secondary-button" id="retryReports">Coba lagi</button></div>';document.querySelector("#retryReports").onclick=loadReports;return;}
 const orders=o.data||[],channels=ch.data||[],sum=(a,k)=>a.reduce((n,x)=>n+Number(x[k]||0),0),daily=new Map();
 orders.forEach(x=>{const key=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(x.ordered_at));daily.set(key,(daily.get(key)||0)+Number(x.total_amount||0));});
 const dailyRows=Array.from({length:7},(_,i)=>{const key=dfDayOffset(i-6);return '<tr><td>'+new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",timeZone:"Asia/Jakarta"}).format(new Date(key+"T12:00:00+07:00"))+'</td><td>'+money(daily.get(key)||0)+'</td></tr>';}).join("");
 const channelRows=channels.map(x=>{const a=orders.filter(z=>z.channel_id===x.id);return '<tr><td>'+escapeHtml(x.name)+'</td><td>'+a.length+'</td><td>'+money(sum(a,"total_amount"))+'</td><td>'+money(sum(a,"platform_fee"))+'</td><td>'+money(sum(a,"net_amount"))+'</td></tr>';}).join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Reports</h1><p>Laporan 7 hari terakhir · transaksi completed saja.</p></div><button class="secondary-button" id="refreshReports">↻ Refresh</button></div><div class="metric-grid"><article class="metric-card"><div class="metric-top"><span>Total omzet</span></div><strong>'+money(sum(orders,"total_amount"))+'</strong><small class="muted">7 hari terakhir</small></article><article class="metric-card"><div class="metric-top"><span>Transaksi selesai</span></div><strong>'+orders.length+'</strong><small class="muted">Tidak termasuk pending</small></article><article class="metric-card"><div class="metric-top"><span>Komisi platform</span></div><strong>'+money(sum(orders,"platform_fee"))+'</strong><small class="muted">Akumulasi komisi</small></article><article class="metric-card"><div class="metric-top"><span>Estimasi diterima</span></div><strong>'+money(sum(orders,"net_amount"))+'</strong><small class="muted">Setelah komisi</small></article></div><div class="content-grid"><article class="panel"><div class="panel-heading"><div><h2>Omzet harian</h2><p>7 hari terakhir</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Omzet</th></tr></thead><tbody>'+dailyRows+'</tbody></table></div></article><article class="panel"><div class="panel-heading"><div><h2>Per channel</h2><p>Transaksi completed</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Channel</th><th>Order</th><th>Omzet</th><th>Komisi</th><th>Diterima</th></tr></thead><tbody>'+channelRows+'</tbody></table></div></article></div><div class="panel"><h2>Catatan laporan</h2><p class="overview-note">Omzet dan estimasi penerimaan bukan laba. HPP dan biaya operasional belum dikurangkan. Pending dan cancelled dikecualikan.</p></div>';
 document.querySelector("#refreshReports").onclick=loadReports;
}
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
 const close=()=>{editorOverlay.remove();host.innerHTML="";};
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


let posState={products:[],channels:[],prices:[],channel:null,cart:[]};
async function loadPOS(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Point of Sale</h1><p>Memuat menu dan harga channel...</p></div></div><div class="panel">Menyiapkan kasir...</div>';
 const [{data:products,error:pe},{data:channels,error:ce},{data:prices,error:pr}]=await Promise.all([
  supabaseClient.from("products").select("id,sku,name,unit,is_active").eq("is_active",true).order("name"),
  supabaseClient.from("sales_channels").select("id,code,name,commission_rate,is_active").eq("is_active",true).order("name"),
  supabaseClient.from("product_channel_prices").select("product_id,channel_id,price")
 ]);
 if(pe||ce||pr){page.innerHTML='<div class="panel"><h2>Kasir belum bisa dimuat</h2><p>'+escapeHtml(pe?.message||ce?.message||pr?.message)+'</p></div>';return;}
 posState={products:products||[],channels:channels||[],prices:prices||[],channel:null,cart:[]};
 posState.channel=posState.channels.find(c=>c.code==="offline")||posState.channels[0]||null;
 renderPOS();
}
function posPrice(productId,channelId){const found=posState.prices.find(x=>x.product_id===productId&&x.channel_id===channelId);return found?Number(found.price):null;}
function renderPOS(){
 cleanupPOSOverlays();
 const page=document.querySelector("#pageContent");
 const channelOptions=posState.channels.map(c=>'<option value="'+c.id+'" '+(posState.channel?.id===c.id?'selected':'')+'>'+escapeHtml(c.name)+' · Komisi '+Number(c.commission_rate||0)+'%</option>').join("");
 const productCards=posState.products.map(p=>{
  const price=posPrice(p.id,posState.channel?.id);
  const unavailable=price===null;
  return '<button class="pos-product '+(unavailable?'unavailable':'')+'" data-add-cart="'+p.id+'" '+(unavailable?'disabled':'')+'><span class="pos-product-name">'+escapeHtml(p.name)+'</span><small>'+escapeHtml(p.sku)+'</small><strong>'+(unavailable?'Harga belum diatur':money(price))+'</strong></button>';
 }).join("");
 page.innerHTML='<div class="welcome-row pos-welcome"><div><div class="eyebrow">MATCHABOY PASID · CASHIER</div><h1>Point of Sale</h1><p>Pilih channel, tambahkan menu, lalu catat transaksi.</p></div></div><div class="pos-layout"><section class="panel pos-menu-panel"><div class="pos-toolbar"><div><h2>Pilih channel penjualan</h2><p>Harga mengikuti channel yang dipilih.</p></div><select id="posChannel" class="pos-select">'+channelOptions+'</select></div><div class="pos-products-grid">'+(productCards||'<p>Belum ada produk aktif.</p>')+'</div></section><aside class="panel pos-cart-panel" id="posCartPanel"><div class="panel-heading"><div><h2>Pesanan</h2><p id="cartCount">0 item</p></div><div class="pos-cart-heading-actions"><button class="text-button" id="clearCart">Kosongkan</button><button class="pos-cart-close" id="closeCartSheet" aria-label="Tutup pesanan">×</button></div></div><div id="cartItems" class="cart-items"><div class="cart-empty">Pilih minuman untuk memulai pesanan</div></div><div class="cart-summary" id="cartSummary"></div><label class="payment-label">Metode pembayaran<select id="paymentMethod" class="pos-select"><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer</option></select></label><label class="payment-label">Catatan (opsional)<textarea id="saleNotes" rows="2" placeholder="Catatan pesanan"></textarea></label><button class="primary-button checkout-button" id="checkoutButton" disabled>Simpan transaksi</button><p class="pos-footnote">Transaksi akan tersimpan ke database setelah tombol ditekan.</p></aside></div><div class="pos-cart-backdrop" id="posCartBackdrop"></div><div class="pos-mobile-cartbar" id="posMobileCartbar"><div class="pos-mobile-cart-info"><span class="pos-mobile-cart-count" id="mobileCartCount">0</span><span><b>Pesanan</b><small id="mobileCartTotal">Belum ada item</small></span></div><button type="button" id="openCartSheet">Lihat pesanan <span>→</span></button></div>';
 if(window.matchMedia("(max-width: 760px)").matches){
  document.body.append(document.querySelector("#posCartPanel"),document.querySelector("#posCartBackdrop"),document.querySelector("#posMobileCartbar"));
 }
 document.querySelector("#posChannel").addEventListener("change",e=>{posState.channel=posState.channels.find(c=>c.id===e.target.value);posState.cart=[];renderPOS();});
 document.querySelectorAll("[data-add-cart]").forEach(btn=>btn.addEventListener("click",()=>addToCart(btn.dataset.addCart)));
 document.querySelector("#clearCart").addEventListener("click",()=>{posState.cart=[];renderPOS();});
 document.querySelector("#checkoutButton").addEventListener("click",submitSale);
 document.querySelector("#openCartSheet").addEventListener("click",()=>toggleCartSheet(true));
 document.querySelector("#closeCartSheet").addEventListener("click",()=>toggleCartSheet(false));
 document.querySelector("#posCartBackdrop").addEventListener("click",()=>toggleCartSheet(false));
 renderCart();
}
function addToCart(id){
 const product=posState.products.find(p=>p.id===id),price=posPrice(id,posState.channel.id);
 if(!product||price===null){notify("Harga produk untuk channel ini belum diatur.");return;}
 const item=posState.cart.find(x=>x.product.id===id);
 if(item)item.quantity++;else posState.cart.push({product,price,quantity:1});
 renderCart();
}
function renderCart(){
 const host=document.querySelector("#cartItems");if(!host)return;
 const count=posState.cart.reduce((n,x)=>n+x.quantity,0);
 const subtotal=posState.cart.reduce((n,x)=>n+x.price*x.quantity,0);
 const rate=Number(posState.channel?.commission_rate||0),fee=Math.round(subtotal*rate/100),net=subtotal-fee;
 document.querySelector("#cartCount").textContent=count+" item";
 host.innerHTML=posState.cart.length?posState.cart.map(x=>'<div class="cart-line"><div class="cart-line-main"><b>'+escapeHtml(x.product.name)+'</b><small>'+money(x.price)+' / cup</small></div><div class="qty-control"><button data-qty-minus="'+x.product.id+'">−</button><span>'+x.quantity+'</span><button data-qty-plus="'+x.product.id+'">+</button></div><strong>'+money(x.price*x.quantity)+'</strong></div>').join(""):'<div class="cart-empty">Pilih minuman untuk memulai pesanan</div>';
 host.querySelectorAll("[data-qty-minus]").forEach(b=>b.addEventListener("click",()=>changeQty(b.dataset.qtyMinus,-1)));
 host.querySelectorAll("[data-qty-plus]").forEach(b=>b.addEventListener("click",()=>changeQty(b.dataset.qtyPlus,1)));
 document.querySelector("#cartSummary").innerHTML='<div><span>Subtotal</span><b>'+money(subtotal)+'</b></div><div><span>Komisi '+rate+'%</span><b>'+money(fee)+'</b></div><div class="cart-net"><span>Estimasi diterima</span><b>'+money(net)+'</b></div>';
 document.querySelector("#checkoutButton").disabled=!posState.cart.length;
 const mobileCount=document.querySelector("#mobileCartCount"),mobileTotal=document.querySelector("#mobileCartTotal");
 if(mobileCount)mobileCount.textContent=String(count);
 if(mobileTotal)mobileTotal.textContent=posState.cart.length?money(subtotal):"Belum ada item";
 const mobileBar=document.querySelector("#posMobileCartbar");
 if(mobileBar)mobileBar.classList.toggle("has-items",count>0);
}
function cleanupPOSOverlays(){
 ["posCartPanel","posCartBackdrop","posMobileCartbar"].forEach(id=>{
  const node=document.getElementById(id);
  if(node&&node.parentElement===document.body)node.remove();
 });
}
function toggleCartSheet(open){
 const panel=document.querySelector("#posCartPanel"),backdrop=document.querySelector("#posCartBackdrop");
 if(!panel||!backdrop)return;
 panel.classList.toggle("is-open",open);
 backdrop.classList.toggle("is-visible",open);
 document.body.classList.toggle("pos-sheet-open",open);
}
function changeQty(id,delta){const item=posState.cart.find(x=>x.product.id===id);if(!item)return;item.quantity+=delta;if(item.quantity<=0)posState.cart=posState.cart.filter(x=>x.product.id!==id);renderCart();}
async function submitSale(){
 if(!posState.cart.length)return;
 const button=document.querySelector("#checkoutButton");button.disabled=true;button.textContent="Menyimpan...";
 try{
  const payload={p_channel_code:posState.channel.code,p_payment_method:document.querySelector("#paymentMethod").value,p_items:posState.cart.map(x=>({product_id:x.product.id,quantity:x.quantity})),p_notes:document.querySelector("#saleNotes").value.trim()||null};
  const {data,error}=await supabaseClient.rpc("create_sale",payload);
  if(error)throw error;
  posState.cart=[];notify("Pesanan tersimpan. Menunggu konfirmasi pembayaran.");await loadOrders();
 }catch(error){notify("Transaksi gagal: "+error.message);button.disabled=false;button.textContent="Simpan transaksi";}
}

async function loadOrders(){
 const page=document.querySelector("#pageContent");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Orders</h1><p>Daftar transaksi dan konfirmasi pembayaran.</p></div><button class="secondary-button" id="refreshOrders">↻ Refresh</button></div><div class="panel">Memuat transaksi...</div>';
 const [orderResult,channelResult]=await Promise.all([
  supabaseClient.from("orders").select("*").order("created_at",{ascending:false}).limit(100),
  supabaseClient.from("sales_channels").select("id,name")
 ]);
 if(orderResult.error||channelResult.error){
  page.innerHTML='<div class="panel"><h2>Gagal memuat transaksi</h2><p>'+escapeHtml(orderResult.error?.message||channelResult.error?.message)+'</p><button class="secondary-button" id="retryOrders">Coba lagi</button></div>';
  document.querySelector("#retryOrders").addEventListener("click",loadOrders);return;
 }
 const orders=orderResult.data||[],channels=channelResult.data||[],ids=orders.map(o=>o.id);
 let items=[];
 if(ids.length){
  const itemResult=await supabaseClient.from("order_items").select("order_id,product_name,quantity,subtotal").in("order_id",ids);
  if(itemResult.error){page.innerHTML='<div class="panel"><h2>Gagal memuat detail pesanan</h2><p>'+escapeHtml(itemResult.error.message)+'</p></div>';return;}
  items=itemResult.data||[];
 }
 const channelMap=new Map(channels.map(c=>[c.id,c.name])),itemMap=new Map();
 items.forEach(i=>{if(!itemMap.has(i.order_id))itemMap.set(i.order_id,[]);itemMap.get(i.order_id).push(i);});
 const pending=orders.filter(o=>o.order_status==="pending").length;
 const rows=orders.map(o=>{
  const lines=(itemMap.get(o.id)||[]).map(i=>'<div class="order-item-line"><span>'+escapeHtml(i.product_name)+' × '+Number(i.quantity)+'</span><b>'+money(i.subtotal)+'</b></div>').join("");
  const labels={pending:"Menunggu pembayaran",processing:"Diproses",completed:"Selesai",cancelled:"Dibatalkan"};
  const date=o.created_at?new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(o.created_at)):"—";
  const payment={cash:"Tunai",qris:"QRIS",transfer:"Transfer"}[o.payment_method]||o.payment_method||"—";
  return '<article class="order-card"><div class="order-card-top"><div><strong>'+escapeHtml(o.order_number)+'</strong><small>'+escapeHtml(channelMap.get(o.channel_id)||"Channel")+' · '+date+'</small></div><span class="order-status '+escapeHtml(o.order_status)+'">'+escapeHtml(labels[o.order_status]||o.order_status)+'</span></div><div class="order-items">'+(lines||"<small>Detail item tidak tersedia.</small>")+'</div><div class="order-totals"><span>Total <b>'+money(o.total_amount)+'</b></span><span>Komisi <b>'+money(o.platform_fee)+'</b></span><span>Estimasi diterima <b>'+money(o.net_amount)+'</b></span></div><div class="order-card-bottom"><small>Pembayaran: '+escapeHtml(payment)+'</small>'+(o.order_status==="pending"?'<button class="primary-button confirm-payment" data-confirm-order="'+o.id+'">Konfirmasi pembayaran</button>':'')+'</div>'+(o.notes?'<p class="order-notes">Catatan: '+escapeHtml(o.notes)+'</p>':'')+'</article>';
 }).join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Orders</h1><p>Kelola transaksi dan konfirmasi pembayaran.</p></div><button class="secondary-button" id="refreshOrders">↻ Refresh</button></div><div class="order-summary"><div class="order-summary-card"><small>Total transaksi terbaru</small><strong>'+orders.length+'</strong></div><div class="order-summary-card"><small>Menunggu konfirmasi</small><strong>'+pending+'</strong></div><div class="order-summary-card"><small>Selesai</small><strong>'+orders.filter(o=>o.order_status==="completed").length+'</strong></div></div><div class="orders-list">'+(rows||'<div class="panel order-empty">Belum ada transaksi. Buat pesanan pertama dari Point of Sale.</div>')+'</div>';
 document.querySelector("#refreshOrders").addEventListener("click",loadOrders);
 document.querySelectorAll("[data-confirm-order]").forEach(b=>b.addEventListener("click",()=>confirmPayment(b.dataset.confirmOrder,b)));
}
async function confirmPayment(orderId,button){
 if(!window.confirm("Pastikan pembayaran sudah benar-benar diterima. Konfirmasi transaksi ini?"))return;
 button.disabled=true;button.textContent="Mengonfirmasi...";
 try{
  const {data,error}=await supabaseClient.rpc("confirm_sale_payment",{p_order_id:orderId});
  if(error)throw error;
  if(!data?.success)throw new Error("Konfirmasi tidak berhasil.");
  notify("Pembayaran berhasil dikonfirmasi.");await loadOrders();
 }catch(error){notify("Gagal konfirmasi: "+error.message);button.disabled=false;button.textContent="Konfirmasi pembayaran";}
}


async function loadPurchasing(){
 const page=document.querySelector("#pageContent");
 if(currentRole!=="owner"){page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Purchasing</h1><p>Modul pembelian dikelola oleh Owner.</p></div></div><div class="panel"><h2>Akses Owner diperlukan</h2><p>Hubungi Owner untuk membuat atau menerima pembelian.</p></div>';return;}
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID · INVENTORY CONTROL</div><h1>Purchasing</h1><p>Kelola pembelian bahan baku dan penerimaan barang.</p></div><button class="primary-button" id="newPurchase">＋ Pembelian baru</button></div><div class="panel">Memuat data pembelian...</div>';
 const [purchases,suppliers,ingredients]=await Promise.all([
  supabaseClient.from("purchases").select("*").order("created_at",{ascending:false}).limit(50),
  supabaseClient.from("suppliers").select("id,name,is_active").eq("is_active",true).order("name"),
  supabaseClient.from("ingredients").select("id,sku,name,unit,stock_quantity,average_cost,is_active").eq("is_active",true).order("name")
 ]);
 const err=[purchases,suppliers,ingredients].find(x=>x.error);
 if(err){page.innerHTML='<div class="panel"><h2>Gagal memuat Purchasing</h2><p>'+escapeHtml(err.error.message)+'</p><button class="secondary-button" id="retryPurchasing">Coba lagi</button></div>';document.querySelector("#retryPurchasing").onclick=loadPurchasing;return;}
 const list=purchases.data||[],supplierMap=new Map((suppliers.data||[]).map(s=>[s.id,s.name])),ids=list.map(x=>x.id);
 let items=[];
 if(ids.length){const r=await supabaseClient.from("purchase_items").select("purchase_id,ingredient_id,quantity,unit,unit_cost,subtotal,purchase_quantity,purchase_unit,conversion_factor,purchase_unit_cost").in("purchase_id",ids);if(r.error){page.innerHTML='<div class="panel"><h2>Gagal memuat rincian pembelian</h2><p>'+escapeHtml(r.error.message)+'</p></div>';return;}items=r.data||[];}
 const ingredientMap=new Map((ingredients.data||[]).map(x=>[x.id,x.name]));
 const itemMap=new Map();items.forEach(x=>{if(!itemMap.has(x.purchase_id))itemMap.set(x.purchase_id,[]);itemMap.get(x.purchase_id).push(x);});
 const draftCount=list.filter(x=>x.purchase_status==="draft").length,receivedCount=list.filter(x=>x.purchase_status==="received").length,totalReceived=list.filter(x=>x.purchase_status==="received").reduce((n,x)=>n+Number(x.total_amount||0),0);
 const statusLabel={draft:"Draft",received:"Diterima",cancelled:"Dibatalkan"};
 const rows=list.map(p=>{const lines=(itemMap.get(p.id)||[]).map(x=>'<div class="purchase-item-preview"><span>'+escapeHtml(ingredientMap.get(x.ingredient_id)||"Bahan")+' · '+Number(x.purchase_quantity??x.quantity)+' '+escapeHtml(x.purchase_unit??x.unit)+' → '+Number(x.quantity)+' '+escapeHtml(x.unit)+'</span><b>'+money(x.subtotal)+'</b></div>').join("");const date=p.purchase_date?new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(p.purchase_date+"T12:00:00+07:00")):"—";return '<article class="purchase-card"><div class="purchase-card-head"><div><strong>'+escapeHtml(p.purchase_number)+'</strong><small>'+date+' · '+escapeHtml(supplierMap.get(p.supplier_id)||"Tanpa supplier")+'</small></div><span class="purchase-status '+escapeHtml(p.purchase_status)+'">'+(statusLabel[p.purchase_status]||escapeHtml(p.purchase_status))+'</span></div><div class="purchase-lines">'+lines+'</div><div class="purchase-card-foot"><strong>'+money(p.total_amount)+'</strong>'+(p.purchase_status==="draft"?'<button class="primary-button receive-purchase" data-receive-purchase="'+p.id+'">Terima barang</button>':'<small class="muted">'+(p.purchase_status==="received"?"Stok sudah diperbarui":"Tidak ada tindakan")+'</small>')+'</div>'+(p.notes?'<p class="purchase-note">'+escapeHtml(p.notes)+'</p>':'')+'</article>';}).join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID · INVENTORY CONTROL</div><h1>Purchasing</h1><p>Buat draft pembelian, lalu terima barang saat bahan tiba.</p></div><button class="primary-button" id="newPurchase">＋ Pembelian baru</button></div><div class="metric-grid"><article class="metric-card"><div class="metric-top"><span>Draft menunggu</span></div><strong>'+draftCount+'</strong><small class="muted">Belum menambah stok</small></article><article class="metric-card"><div class="metric-top"><span>Pembelian diterima</span></div><strong>'+receivedCount+'</strong><small class="muted">Sudah masuk persediaan</small></article><article class="metric-card"><div class="metric-top"><span>Nilai pembelian diterima</span></div><strong>'+money(totalReceived)+'</strong><small class="muted">Dari 50 transaksi terbaru</small></article><article class="metric-card"><div class="metric-top"><span>Bahan baku aktif</span></div><strong>'+(ingredients.data||[]).length+'</strong><small class="muted">Terdaftar di inventory</small></article></div><div class="panel"><div class="panel-heading"><div><h2>Riwayat pembelian</h2><p>50 pembelian terbaru</p></div><button class="text-button" id="refreshPurchasing">↻ Refresh</button></div><div class="purchase-list">'+(rows||'<div class="order-empty">Belum ada pembelian.</div>')+'</div></div><div id="purchaseEditor"></div>';
 document.querySelector("#newPurchase").onclick=()=>openPurchaseEditor(ingredients.data||[],suppliers.data||[]);
 document.querySelector("#refreshPurchasing").onclick=loadPurchasing;
 document.querySelectorAll("[data-receive-purchase]").forEach(b=>b.onclick=()=>receivePurchase(b.dataset.receivePurchase,b));
}
function openPurchaseEditor(ingredients,suppliers){
 const host=document.querySelector("#purchaseEditor");
 const ingredientOptions=ingredients.map(i=>'<option value="'+i.id+'" data-unit="'+escapeHtml(i.unit)+'">'+escapeHtml(i.name)+' ('+escapeHtml(i.unit)+')</option>').join("");
 const supplierOptions='<option value="">Tanpa supplier</option>'+suppliers.map(s=>'<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>').join("");
 host.innerHTML='<div class="editor-backdrop"><form class="purchase-editor" id="purchaseForm"><div class="editor-heading"><div><div class="eyebrow">PURCHASING</div><h2>Pembelian baru</h2><p>Transaksi akan disimpan sebagai draft. Stok belum berubah sampai barang diterima.</p></div><button type="button" class="icon-close" id="closePurchaseEditor">×</button></div><label class="purchase-form-label">Supplier<select name="supplier_id">'+supplierOptions+'</select></label><div class="purchase-form-label"><span>Item pembelian</span><div id="purchaseLineRows"></div><button type="button" class="secondary-button add-purchase-line" id="addPurchaseLine">＋ Tambah bahan</button></div><label class="purchase-form-label">Catatan<textarea name="notes" rows="2" placeholder="Nomor nota atau catatan pembelian (opsional)"></textarea></label><div class="purchase-total"><span>Total pembelian</span><strong id="purchaseTotal">Rp0</strong></div><div class="editor-actions"><button type="button" class="secondary-button" id="cancelPurchaseEditor">Batal</button><button type="submit" class="primary-button" id="savePurchase">Simpan draft</button></div><p class="editor-message" id="purchaseMessage"></p></form></div>';
 const rows=document.querySelector("#purchaseLineRows");
 const packageChoices=(ingredient)=>{
  const name=(ingredient?.name||"").toLowerCase(),unit=ingredient?.unit||"";
  if(name.includes("yakult"))return [{label:"Bungkus isi 5 pcs",unit:"bungkus-5",factor:5},{label:"Pcs",unit:"pcs",factor:1}];
  if(name.includes("hydrococo"))return [{label:"Botol 250 ml",unit:"botol-250ml",factor:250},{label:"Mililiter",unit:"ml",factor:1}];
  if(name.includes("uht"))return [{label:"Kotak 1 liter",unit:"kotak",factor:1000},{label:"Karton 12 × 1 liter",unit:"karton",factor:12000},{label:"Liter",unit:"liter",factor:1000},{label:"Mililiter",unit:"ml",factor:1}];
  if(name.includes("susu kental manis")||name.includes("skm"))return [{label:"Kaleng 370 ml",unit:"kaleng",factor:370},{label:"Dus 48 × 370 ml",unit:"dus",factor:17760},{label:"Liter",unit:"liter",factor:1000},{label:"Mililiter",unit:"ml",factor:1}];
  if(name.includes("matcha")||name.includes("bubuk"))return [{label:"Kilogram",unit:"kg",factor:1000},{label:"Gram",unit:"gram",factor:1}];
  if(name.includes("es batu"))return [{label:"Kemasan 5 kg",unit:"kemasan-5kg",factor:5000},{label:"Kotak 5 kg",unit:"kotak-5kg",factor:5000},{label:"Kilogram",unit:"kg",factor:1000},{label:"Gram",unit:"gram",factor:1}];
  if(unit==="ml")return [{label:"Mililiter",unit:"ml",factor:1}];
  if(unit==="pcs")return [{label:"Pcs",unit:"pcs",factor:1}];
  return [{label:unit,unit:unit,factor:1}];
 };
 const updateRow=(row)=>{
  const id=row.querySelector(".purchase-ingredient").value,ingredient=ingredients.find(x=>x.id===id),packages=packageChoices(ingredient),select=row.querySelector(".purchase-package");
  const previous=select.value;
  select.innerHTML=packages.map(p=>'<option value="'+p.unit+'" data-factor="'+p.factor+'">'+escapeHtml(p.label)+'</option>').join("");
  if(packages.some(p=>p.unit===previous))select.value=previous;
  const chosen=packages.find(p=>p.unit===select.value)||packages[0];
  const qty=Number(row.querySelector(".purchase-quantity").value)||0,cost=Number(row.querySelector(".purchase-cost").value)||0;
  row.querySelector(".purchase-unit").textContent=ingredient?('Stok masuk: '+(qty*chosen.factor).toLocaleString("id-ID")+' '+ingredient.unit+' · biaya/'+ingredient.unit+' Rp '+new Intl.NumberFormat("id-ID",{minimumFractionDigits:0,maximumFractionDigits:2}).format(cost/chosen.factor)):"Pilih bahan terlebih dahulu";
  updateTotal();
 };
 const addLine=()=>{
  const row=document.createElement("div");row.className="purchase-line-input";
  row.innerHTML='<label>Bahan<select class="purchase-ingredient" required><option value="">Pilih bahan</option>'+ingredientOptions+'</select></label><label>Kemasan<select class="purchase-package" required><option value="">Pilih bahan dulu</option></select></label><label>Jumlah kemasan<input class="purchase-quantity" type="number" min="0.001" step="0.001" placeholder="0" required></label><label>Harga per kemasan<input class="purchase-cost" type="number" min="0" step="1" placeholder="Rp" required></label><small class="purchase-unit">Pilih bahan terlebih dahulu</small><button type="button" class="remove-purchase-line" aria-label="Hapus item">×</button>';
  rows.appendChild(row);
  row.querySelector(".purchase-ingredient").addEventListener("change",()=>updateRow(row));
  row.querySelector(".purchase-package").addEventListener("change",()=>updateRow(row));
  row.querySelectorAll("input").forEach(x=>x.addEventListener("input",()=>updateRow(row)));
  row.querySelector(".remove-purchase-line").onclick=()=>{row.remove();updateTotal();};
 };
 const updateTotal=()=>{const total=[...rows.querySelectorAll(".purchase-line-input")].reduce((n,r)=>n+(Number(r.querySelector(".purchase-quantity").value)||0)*(Number(r.querySelector(".purchase-cost").value)||0),0);document.querySelector("#purchaseTotal").textContent=money(total);};
 const close=()=>host.innerHTML="";
 document.querySelector("#closePurchaseEditor").onclick=close;document.querySelector("#cancelPurchaseEditor").onclick=close;document.querySelector("#addPurchaseLine").onclick=addLine;addLine();
 document.querySelector("#purchaseForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=document.querySelector("#savePurchase"),message=document.querySelector("#purchaseMessage");const items=[...rows.querySelectorAll(".purchase-line-input")].map(r=>{const select=r.querySelector(".purchase-ingredient"),pkg=r.querySelector(".purchase-package"),ingredient=ingredients.find(x=>x.id===select.value),factor=Number(pkg.selectedOptions[0]?.dataset.factor),quantity=Number(r.querySelector(".purchase-quantity").value),cost=Number(r.querySelector(".purchase-cost").value);return {ingredient_id:select.value,unit:ingredient?.unit,purchase_quantity:quantity,purchase_unit:pkg.value,conversion_factor:factor,purchase_unit_cost:cost};});if(!items.length||items.some(x=>!x.ingredient_id||!Number.isFinite(x.purchase_quantity)||x.purchase_quantity<=0||!Number.isFinite(x.conversion_factor)||x.conversion_factor<=0||!Number.isFinite(x.purchase_unit_cost)||x.purchase_unit_cost<0)){message.textContent="Lengkapi bahan, kemasan, jumlah, dan harga setiap item.";return;}button.disabled=true;button.textContent="Menyimpan...";try{const fd=new FormData(form);const {data,error}=await supabaseClient.rpc("create_purchase",{p_supplier_id:fd.get("supplier_id")||null,p_items:items,p_notes:String(fd.get("notes")||"").trim()||null});if(error)throw error;if(!data?.success)throw new Error("Draft pembelian tidak berhasil dibuat.");close();notify("Draft pembelian berhasil dibuat.");await loadPurchasing();}catch(error){message.textContent="Gagal menyimpan: "+error.message;button.disabled=false;button.textContent="Simpan draft";}};
}
async function receivePurchase(id,button){
 if(!window.confirm("Konfirmasi barang sudah diterima secara fisik? Stok bahan baku akan bertambah."))return;
 button.disabled=true;button.textContent="Memproses...";
 try{const {data,error}=await supabaseClient.rpc("receive_purchase",{p_purchase_id:id});if(error)throw error;if(!data?.success)throw new Error("Penerimaan tidak berhasil.");notify("Barang diterima. Stok berhasil diperbarui.");await loadPurchasing();}catch(error){notify("Gagal menerima barang: "+error.message);button.disabled=false;button.textContent="Terima barang";}
}
async function loadInventory(){
 const page=document.querySelector("#pageContent");
 if(currentRole!=="owner"){page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Inventory</h1><p>Informasi persediaan dikelola oleh Owner.</p></div></div><div class="panel"><h2>Akses Owner diperlukan</h2><p>Hubungi Owner untuk melihat dan mengelola stok bahan baku.</p></div>';return;}
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID · STOCK CONTROL</div><h1>Inventory</h1><p>Pantau stok bahan baku dan riwayat pergerakannya.</p></div><button class="secondary-button" id="refreshInventory">↻ Refresh</button></div><div class="panel">Memuat persediaan...</div>';
 const [ingredients,movements]=await Promise.all([
  supabaseClient.from("ingredients").select("*").order("name"),
  supabaseClient.from("inventory_movements").select("id,ingredient_id,movement_type,quantity,unit,reference_type,notes,created_at").order("created_at",{ascending:false}).limit(30)
 ]);
 const err=ingredients.error||movements.error;
 if(err){page.innerHTML='<div class="panel"><h2>Gagal memuat Inventory</h2><p>'+escapeHtml(err.message)+'</p><button class="secondary-button" id="retryInventory">Coba lagi</button></div>';document.querySelector("#retryInventory").onclick=loadInventory;return;}
 const data=ingredients.data||[],active=data.filter(x=>x.is_active!==false),totalValue=active.reduce((n,x)=>n+Number(x.stock_quantity||0)*Number(x.average_cost||0),0),low=active.filter(x=>Number(x.stock_quantity||0)<=Number(x.minimum_stock||0));
 const rows=data.map(x=>'<tr><td><strong>'+escapeHtml(x.name)+'</strong><small class="table-sub">'+escapeHtml(x.sku||"Tanpa SKU")+'</small></td><td>'+escapeHtml(x.unit)+'</td><td><strong>'+Number(x.stock_quantity||0).toLocaleString("id-ID")+'</strong></td><td>'+money(x.average_cost)+'</td><td>'+money(Number(x.stock_quantity||0)*Number(x.average_cost||0))+'</td><td><span class="product-status '+(x.is_active===false?"inactive":Number(x.stock_quantity||0)<=Number(x.minimum_stock||0)?"inactive":"")+'">'+(x.is_active===false?"Nonaktif":Number(x.stock_quantity||0)<=Number(x.minimum_stock||0)?"Perlu stok":"Tersedia")+'</span></td></tr>').join("");
 const nameMap=new Map(data.map(x=>[x.id,x.name])),typeLabel={purchase:"Pembelian",sale:"Pemakaian",adjustment:"Penyesuaian",waste:"Rusak",return:"Retur"};
 const movementRows=(movements.data||[]).map(x=>'<tr><td>'+new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(x.created_at))+'</td><td>'+escapeHtml(nameMap.get(x.ingredient_id)||"Bahan")+'</td><td>'+escapeHtml(typeLabel[x.movement_type]||x.movement_type)+'</td><td>'+Number(x.quantity).toLocaleString("id-ID")+' '+escapeHtml(x.unit)+'</td><td>'+escapeHtml(x.notes||"—")+'</td></tr>').join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID · STOCK CONTROL</div><h1>Inventory</h1><p>Persediaan bahan baku berdasarkan penerimaan dan pergerakan stok.</p></div><div class="inventory-actions"><button class="secondary-button" id="refreshInventory">↻ Refresh</button><button class="primary-button" id="addIngredientButton">＋ Tambah bahan</button></div></div><div class="metric-grid"><article class="metric-card"><div class="metric-top"><span>Bahan aktif</span></div><strong>'+active.length+'</strong><small class="muted">Jenis bahan baku</small></article><article class="metric-card"><div class="metric-top"><span>Stok perlu diperiksa</span></div><strong>'+low.length+'</strong><small class="muted">Stok sama dengan atau di bawah minimum</small></article><article class="metric-card"><div class="metric-top"><span>Nilai persediaan</span></div><strong>'+money(totalValue)+'</strong><small class="muted">Stok × average cost</small></article><article class="metric-card"><div class="metric-top"><span>Pergerakan terbaru</span></div><strong>'+(movements.data||[]).length+'</strong><small class="muted">30 catatan terakhir</small></article></div><div class="panel"><div class="panel-heading"><div><h2>Daftar bahan baku</h2><p>Bahan baru dimulai dengan stok nol. Catat stok dan harga melalui Purchasing.</p></div><button class="text-button" data-view="purchasing">Buka Purchasing →</button></div><div class="table-wrap"><table class="data-table inventory-table"><thead><tr><th>Bahan</th><th>Satuan dasar</th><th>Stok</th><th>Average cost</th><th>Nilai stok</th><th>Status</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Belum ada bahan baku.</td></tr>')+'</tbody></table></div></div><div class="panel"><div class="panel-heading"><div><h2>Riwayat pergerakan stok</h2><p>30 aktivitas terakhir</p></div></div><div class="table-wrap"><table class="data-table inventory-table"><thead><tr><th>Waktu</th><th>Bahan</th><th>Jenis</th><th>Jumlah</th><th>Catatan</th></tr></thead><tbody>'+(movementRows||'<tr><td colspan="5">Belum ada pergerakan stok.</td></tr>')+'</tbody></table></div></div><div id="ingredientEditorHost"></div>';
 document.querySelector("#refreshInventory").onclick=loadInventory;
 document.querySelector("#addIngredientButton").onclick=openIngredientEditor;
 page.querySelector('[data-view="purchasing"]').onclick=()=>navigate("purchasing");
}

function openIngredientEditor(){
 if(currentRole!=="owner"){notify("Hanya Owner yang dapat menambahkan bahan.");return;}
 const host=document.querySelector("#ingredientEditorHost");
 if(!host)return;
 host.innerHTML='<div class="editor-backdrop"><form class="ingredient-editor" id="ingredientForm"><div class="editor-heading"><div><div class="eyebrow">INVENTORY MANAGEMENT</div><h2>Tambah bahan baku</h2><p>Daftarkan bahan terlebih dahulu, lalu catat stok masuk melalui Purchasing.</p></div><button type="button" class="icon-close" id="closeIngredientEditor">×</button></div><div class="ingredient-form-grid"><label>SKU bahan<input name="sku" required maxlength="30" placeholder="ING006" autocomplete="off"></label><label>Nama bahan<input name="name" required maxlength="100" placeholder="Contoh: Sirup Vanilla"></label><label>Satuan dasar<select name="unit" required><option value="">Pilih satuan</option><option value="gram">gram</option><option value="ml">ml</option><option value="pcs">pcs</option></select><small>Gunakan satuan dasar untuk resep dan stok.</small></label><label>Stok minimum<input name="minimum_stock" type="number" min="0" step="any" value="0" required><small>Peringatan saat stok mencapai batas ini.</small></label></div><div class="ingredient-stock-note"><strong>Stok awal: 0</strong><span>Harga rata-rata: Rp0</span><p>Stok dan harga tidak diisi di sini. Buat pembelian di menu Purchasing agar stok, average cost, dan riwayat pembelian tercatat dengan benar.</p></div><div class="editor-actions"><button type="button" class="secondary-button" id="cancelIngredientEditor">Batal</button><button type="submit" class="primary-button" id="saveIngredientButton">Simpan bahan</button></div><p class="editor-message" id="ingredientEditorMessage"></p></form></div>';
 const close=()=>{editorOverlay.remove();host.innerHTML="";};
 document.querySelector("#closeIngredientEditor").onclick=close;
 document.querySelector("#cancelIngredientEditor").onclick=close;
 document.querySelector("#ingredientForm").onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=document.querySelector("#saveIngredientButton"),message=document.querySelector("#ingredientEditorMessage"),fd=new FormData(form);
  const payload={sku:String(fd.get("sku")||"").trim().toUpperCase(),name:String(fd.get("name")||"").trim(),unit:String(fd.get("unit")||""),stock_quantity:0,minimum_stock:Number(fd.get("minimum_stock")),average_cost:0,is_active:true};
  if(!payload.sku||!payload.name||!["gram","ml","pcs"].includes(payload.unit)||!Number.isFinite(payload.minimum_stock)||payload.minimum_stock<0){message.textContent="Periksa kembali SKU, nama, satuan, dan stok minimum.";return;}
  button.disabled=true;button.textContent="Menyimpan...";
  try{
   const {data,error}=await supabaseClient.from("ingredients").insert(payload).select("id,sku,name").single();
   if(error)throw error;
   close();notify("Bahan "+data.name+" berhasil ditambahkan. Lanjut catat pembelian di Purchasing.");await loadInventory();
  }catch(error){message.textContent="Gagal menambahkan bahan: "+error.message;button.disabled=false;button.textContent="Simpan bahan";}
 };
}

async function loadCostRecipe(){
 const page=document.querySelector("#pageContent");
 if(currentRole!=="owner"){page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID</div><h1>Cost & Recipe</h1><p>Pengelolaan HPP dan resep hanya tersedia untuk Owner.</p></div></div><div class="panel"><h2>Akses Owner diperlukan</h2><p>Kasir tidak dapat mengubah HPP atau resep.</p></div>';return;}
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID · COST CONTROL</div><h1>Cost & Recipe</h1><p>Kelola komposisi resep dan pantau HPP berdasarkan average cost bahan baku.</p></div><button class="secondary-button" id="refreshCostRecipe">↻ Refresh</button></div><div class="panel">Memuat resep dan menghitung HPP...</div>';
 const [productResult,ingredientResult,recipeResult]=await Promise.all([
  supabaseClient.from("products").select("id,sku,name,is_active").eq("is_active",true).order("name"),
  supabaseClient.from("ingredients").select("id,sku,name,unit,stock_quantity,average_cost,is_active").eq("is_active",true).order("name"),
  supabaseClient.from("recipes").select("id,product_id,name,version,is_active").eq("is_active",true)
 ]);
 const loadError=productResult.error||ingredientResult.error||recipeResult.error;
 if(loadError){page.innerHTML='<div class="panel"><h2>Gagal memuat Cost & Recipe</h2><p>'+escapeHtml(loadError.message)+'</p><button class="secondary-button" id="retryCostRecipe">Coba lagi</button></div>';document.querySelector("#retryCostRecipe").onclick=loadCostRecipe;return;}
 const products=productResult.data||[],ingredients=ingredientResult.data||[],recipes=recipeResult.data||[];
 const recipeIds=recipes.map(x=>x.id);
 let recipeLines=[];
 if(recipeIds.length){
  const lineResult=await supabaseClient.from("recipe_ingredients").select("id,recipe_id,ingredient_id,quantity,unit").in("recipe_id",recipeIds);
  if(lineResult.error){page.innerHTML='<div class="panel"><h2>Gagal memuat detail resep</h2><p>'+escapeHtml(lineResult.error.message)+'</p><button class="secondary-button" id="retryCostRecipe">Coba lagi</button></div>';document.querySelector("#retryCostRecipe").onclick=loadCostRecipe;return;}
  recipeLines=lineResult.data||[];
 }
 const recipeByProduct=new Map(recipes.map(x=>[x.product_id,x]));
 const linesByRecipe=new Map();
 recipeLines.forEach(x=>{if(!linesByRecipe.has(x.recipe_id))linesByRecipe.set(x.recipe_id,[]);linesByRecipe.get(x.recipe_id).push(x);});
 const results=await Promise.all(products.map(async p=>{
  const r=await supabaseClient.rpc("calculate_product_hpp",{p_product_sku:p.sku});
  if(r.error)return {product:p,error:r.error.message,recipe:recipeByProduct.get(p.id)||null};
  const d=Array.isArray(r.data)?r.data[0]:r.data;
  return {product:p,data:d||null,recipe:recipeByProduct.get(p.id)||null};
 }));
 const ready=results.filter(x=>x.data&&x.data.hpp!==null&&!Number(x.data.ingredients_with_missing_cost)).length;
 const missing=results.length-ready;
 const total=results.reduce((n,x)=>n+(Number(x.data?.hpp)||0),0);
 const rows=results.map(x=>{
  const d=x.data,problem=x.error||(!d?"Resep belum tersedia":Number(d.ingredients_with_missing_cost)>0?"Ada bahan tanpa biaya":d.hpp===null?"HPP belum dapat dihitung":"");
  const version=x.recipe?'v'+x.recipe.version:'Belum ada';
  return '<tr><td><strong>'+escapeHtml(x.product.name)+'</strong><small class="table-sub">'+escapeHtml(x.product.sku)+'</small></td><td>'+(d?escapeHtml(d.recipe_name||x.recipe?.name||"—"):"—")+'<small class="table-sub">'+version+'</small></td><td>'+(d&&d.hpp!==null?'<strong>'+money(d.hpp)+'</strong>':'—')+'</td><td><span class="product-status '+(problem?'inactive':'')+'">'+(problem?escapeHtml(problem):'Siap')+'</span></td><td><button class="table-action" data-recipe-edit="'+x.product.id+'">Edit resep</button></td></tr>';
 }).join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID · COST CONTROL</div><h1>Cost & Recipe</h1><p>HPP dihitung otomatis dari average cost bahan baku dan takaran resep.</p></div><button class="secondary-button" id="refreshCostRecipe">↻ Refresh</button></div><div class="metric-grid"><article class="metric-card"><div class="metric-top"><span>Produk aktif</span></div><strong>'+results.length+'</strong><small class="muted">Menu terdaftar</small></article><article class="metric-card"><div class="metric-top"><span>HPP siap</span></div><strong>'+ready+'</strong><small class="muted">Semua bahan memiliki biaya</small></article><article class="metric-card"><div class="metric-top"><span>Perlu dilengkapi</span></div><strong>'+missing+'</strong><small class="muted">Resep atau biaya belum lengkap</small></article><article class="metric-card"><div class="metric-top"><span>Total HPP seluruh menu</span></div><strong>'+money(total)+'</strong><small class="muted">Jumlah HPP per satuan produk</small></article></div><div class="panel"><div class="panel-heading"><div><h2>HPP dan resep per produk</h2><p>Edit komposisi untuk membuat versi resep berikutnya.</p></div></div><div class="table-wrap"><table class="data-table inventory-table"><thead><tr><th>Produk</th><th>Resep aktif</th><th>HPP / unit</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">Belum ada produk aktif.</td></tr>')+'</tbody></table></div></div><div class="panel cost-recipe-note"><h2>Riwayat versi</h2><p>Setiap penyimpanan membuat versi resep baru. Versi sebelumnya tetap tersimpan dan tidak dihapus. Harga bahan mengikuti pembelian dan average cost Inventory.</p></div><div id="recipeEditorHost"></div>';
 document.querySelector("#refreshCostRecipe").onclick=loadCostRecipe;
 page.querySelectorAll("[data-recipe-edit]").forEach(button=>button.addEventListener("click",()=>{
  const product=products.find(x=>x.id===button.dataset.recipeEdit);
  const activeRecipe=recipeByProduct.get(product.id)||null;
  const currentLines=activeRecipe?(linesByRecipe.get(activeRecipe.id)||[]):[];
  openRecipeEditor(product,ingredients,activeRecipe,currentLines);
 }));
}

function openRecipeEditor(product,ingredients,activeRecipe,currentLines){
 const host=document.querySelector("#recipeEditorHost");
 if(!host)return;
 const initial=currentLines.length?currentLines.map(x=>({ingredient_id:x.ingredient_id,quantity:x.quantity,unit:x.unit})):[];
 let items=initial.length?initial:[{ingredient_id:"",quantity:"",unit:""}];
 const options='<option value="">Pilih bahan baku</option>'+ingredients.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.name)+' · '+escapeHtml(x.unit)+'</option>').join("");
 host.innerHTML='<div class="editor-backdrop recipe-editor-backdrop"><form class="recipe-editor" id="recipeEditorForm"><div class="editor-heading"><div><div class="eyebrow">RECIPE MANAGEMENT · '+escapeHtml(product.sku)+'</div><h2>Edit resep '+escapeHtml(product.name)+'</h2><p>'+(activeRecipe?'Versi aktif v'+activeRecipe.version:'Belum ada resep aktif · akan dibuat sebagai versi pertama')+'</p></div><button type="button" class="icon-close" id="closeRecipeEditor">×</button></div><label class="recipe-name-field">Nama resep<input name="recipe_name" required maxlength="100" value="'+escapeHtml(activeRecipe?.name||product.name+' - Standar')+'"></label><div class="recipe-lines-heading"><div><h3>Komposisi bahan</h3><p>Takaran menggunakan satuan dasar Inventory.</p></div><button type="button" class="secondary-button" id="addRecipeIngredient">＋ Tambah bahan</button></div><div id="recipeIngredientRows"></div><div class="recipe-editor-hint">Pastikan satuan takaran sesuai dengan satuan bahan baku. HPP akan dihitung ulang setelah resep disimpan.</div><div class="editor-actions"><button type="button" class="secondary-button" id="cancelRecipeEditor">Batal</button><button type="submit" class="primary-button" id="saveRecipeButton">Simpan versi resep</button></div><p class="editor-message" id="recipeEditorMessage"></p></form></div>';
 const editorOverlay=host.firstElementChild;
 document.body.appendChild(editorOverlay);
 const rowsHost=document.querySelector("#recipeIngredientRows");
 const renderRows=()=>{
  rowsHost.innerHTML=items.map((item,index)=>{
   const selected=ingredients.find(x=>x.id===item.ingredient_id);
   return '<div class="recipe-line" data-recipe-line="'+index+'"><label class="recipe-ingredient-field"><span>Bahan baku</span><select class="recipe-ingredient">'+options+'</select><small class="recipe-stock">'+(selected?'Stok: '+Number(selected.stock_quantity||0).toLocaleString("id-ID")+' '+escapeHtml(selected.unit)+' · '+money(selected.average_cost)+' / '+escapeHtml(selected.unit):'Pilih bahan untuk melihat stok dan biaya')+'</small></label><label class="recipe-quantity-field"><span>Takaran</span><input class="recipe-quantity" type="number" min="0.001" step="any" required placeholder="0" value="'+escapeHtml(item.quantity)+'"></label><label class="recipe-unit-field"><span>Satuan</span><input class="recipe-unit" value="'+escapeHtml(item.unit||selected?.unit||"")+'" readonly placeholder="Otomatis"></label><button type="button" class="remove-recipe-line" aria-label="Hapus bahan" '+(items.length===1?'disabled':'')+'>×</button></div>';
  }).join("");
  rowsHost.querySelectorAll(".recipe-line").forEach((row,index)=>{
   const select=row.querySelector(".recipe-ingredient"),unit=row.querySelector(".recipe-unit"),stock=row.querySelector(".recipe-stock");
   select.value=items[index].ingredient_id||"";
   select.onchange=()=>{
    const ingredient=ingredients.find(x=>x.id===select.value);
    items[index].ingredient_id=select.value;items[index].unit=ingredient?.unit||"";
    unit.value=ingredient?.unit||"";
    stock.textContent=ingredient?'Stok: '+Number(ingredient.stock_quantity||0).toLocaleString("id-ID")+' '+ingredient.unit+' · '+money(ingredient.average_cost)+' / '+ingredient.unit:'Pilih bahan untuk melihat stok dan biaya';
   };
   row.querySelector(".recipe-quantity").oninput=e=>items[index].quantity=e.target.value;
   row.querySelector(".remove-recipe-line").onclick=()=>{if(items.length>1){items.splice(index,1);renderRows();}};
  });
 };
 const close=()=>{host.innerHTML="";};
 document.querySelector("#closeRecipeEditor").onclick=close;
 document.querySelector("#cancelRecipeEditor").onclick=close;
 document.querySelector("#addRecipeIngredient").onclick=()=>{items.push({ingredient_id:"",quantity:"",unit:""});renderRows();};
 renderRows();
 document.querySelector("#recipeEditorForm").onsubmit=async event=>{
  event.preventDefault();
  const button=document.querySelector("#saveRecipeButton"),message=document.querySelector("#recipeEditorMessage");
  const payload=items.map(x=>({ingredient_id:x.ingredient_id,quantity:Number(x.quantity),unit:x.unit}));
  if(payload.some(x=>!x.ingredient_id||!Number.isFinite(x.quantity)||x.quantity<=0||!x.unit)){message.textContent="Pilih bahan dan isi takaran yang valid pada setiap baris.";return;}
  if(new Set(payload.map(x=>x.ingredient_id)).size!==payload.length){message.textContent="Bahan yang sama hanya boleh dimasukkan satu kali.";return;}
  button.disabled=true;button.textContent="Menyimpan...";
  try{
   const recipeName=String(new FormData(event.currentTarget).get("recipe_name")||"").trim();
   const {data,error}=await supabaseClient.rpc("save_product_recipe",{p_product_id:product.id,p_recipe_name:recipeName,p_items:payload});
   if(error)throw error;
   if(!data?.success)throw new Error("Penyimpanan resep tidak berhasil.");
   notify("Resep tersimpan sebagai versi v"+data.version+".");
   close();
   await loadCostRecipe();
  }catch(error){message.textContent="Gagal menyimpan resep: "+error.message;button.disabled=false;button.textContent="Simpan versi resep";}
 };
}

function navigate(view){if(view!=="pos")cleanupPOSOverlays();try{sessionStorage.setItem("drinkflow:lastView",view);}catch(error){}document.querySelector("#breadcrumbTitle").textContent=labels[view]||"Overview";document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));document.querySelector("#sidebar").classList.remove("open");if(view==="products"){loadProducts();return;}if(view==="pos"){loadPOS();return;}if(view==="orders"){loadOrders();return;}if(view==="purchasing"){loadPurchasing();return;}if(view==="inventory"){loadInventory();return;}if(view==="costRecipe"){loadCostRecipe();return;}if(view==="overview"){loadOverview();return;}if(view==="reports"){loadReports();return;}if(view!=="overview"){notify((labels[view]||view)+" module sedang disiapkan.");return;}}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.view)));
document.querySelector("#mobileMenu").addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
if(initSupabase()){
 supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){appShell.hidden=true;authGate.hidden=false;}});
 checkSession();
}
