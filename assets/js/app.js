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
 const page=document.querySelector("#pageContent");
 const channelOptions=posState.channels.map(c=>'<option value="'+c.id+'" '+(posState.channel?.id===c.id?'selected':'')+'>'+escapeHtml(c.name)+' · Komisi '+Number(c.commission_rate||0)+'%</option>').join("");
 const productCards=posState.products.map(p=>{
  const price=posPrice(p.id,posState.channel?.id);
  const unavailable=price===null;
  return '<button class="pos-product '+(unavailable?'unavailable':'')+'" data-add-cart="'+p.id+'" '+(unavailable?'disabled':'')+'><span class="pos-product-name">'+escapeHtml(p.name)+'</span><small>'+escapeHtml(p.sku)+'</small><strong>'+(unavailable?'Harga belum diatur':money(price))+'</strong></button>';
 }).join("");
 page.innerHTML='<div class="welcome-row"><div><div class="eyebrow">MATCHABOY PASID · CASHIER</div><h1>Point of Sale</h1><p>Pilih channel, tambahkan menu, lalu catat transaksi.</p></div></div><div class="pos-layout"><section class="panel pos-menu-panel"><div class="pos-toolbar"><div><h2>Pilih channel penjualan</h2><p>Harga mengikuti channel yang dipilih.</p></div><select id="posChannel" class="pos-select">'+channelOptions+'</select></div><div class="pos-products-grid">'+(productCards||'<p>Belum ada produk aktif.</p>')+'</div></section><aside class="panel pos-cart-panel"><div class="panel-heading"><div><h2>Pesanan</h2><p id="cartCount">0 item</p></div><button class="text-button" id="clearCart">Kosongkan</button></div><div id="cartItems" class="cart-items"><div class="cart-empty">Pilih minuman untuk memulai pesanan</div></div><div class="cart-summary" id="cartSummary"></div><label class="payment-label">Metode pembayaran<select id="paymentMethod" class="pos-select"><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer</option></select></label><label class="payment-label">Catatan (opsional)<textarea id="saleNotes" rows="2" placeholder="Catatan pesanan"></textarea></label><button class="primary-button checkout-button" id="checkoutButton" disabled>Simpan transaksi</button><p class="pos-footnote">Transaksi akan tersimpan ke database setelah tombol ditekan.</p></aside></div>';
 document.querySelector("#posChannel").addEventListener("change",e=>{posState.channel=posState.channels.find(c=>c.id===e.target.value);posState.cart=[];renderPOS();});
 document.querySelectorAll("[data-add-cart]").forEach(btn=>btn.addEventListener("click",()=>addToCart(btn.dataset.addCart)));
 document.querySelector("#clearCart").addEventListener("click",()=>{posState.cart=[];renderPOS();});
 document.querySelector("#checkoutButton").addEventListener("click",submitSale);
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

function navigate(view){document.querySelector("#breadcrumbTitle").textContent=labels[view]||"Overview";document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));document.querySelector("#sidebar").classList.remove("open");if(view==="products"){loadProducts();return;}if(view==="pos"){loadPOS();return;}if(view==="orders"){loadOrders();return;}if(view==="overview"){loadOverview();return;}if(view==="reports"){loadReports();return;}if(view!=="overview"){notify((labels[view]||view)+" module sedang disiapkan.");return;}}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.view)));
document.querySelector("#mobileMenu").addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
if(initSupabase()){
 supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){appShell.hidden=true;authGate.hidden=false;}});
 checkSession();
}
