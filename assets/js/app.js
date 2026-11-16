const products = [
  ["MTC001","Matcha Original",15000],
  ["MTC002","Strawberry Matcha Cream",19000],
  ["MTC003","Ube Matcha Cream",19000],
  ["MTC004","Honey Matcha",18000],
  ["MTC005","Matcha Cloud",18000],
  ["MTC006","Matcha Cookies",19000],
  ["MTC007","Coklat Matcha",19000],
  ["MTC008","Matcha Yakult",19000],
  ["MTC009","Matcha Oreo",19000],
  ["MTC010","Matcha Coconut",19000],
  ["MTC011","Matcha Caramel",19000]
];

const money = value => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(value);

const popular = document.querySelector("#popularProducts");
if (popular) {
  popular.innerHTML = products.slice(0, 6).map(([sku, name, price]) =>
    `<div class="product-item"><span>${name}</span><span>${money(price)}</span></div>`
  ).join("");
}

const dateLabel = document.querySelector("#todayLabel");
if (dateLabel) {
  dateLabel.textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    timeZone: "Asia/Jakarta"
  }).format(new Date());
}
document.querySelector("#year").textContent = new Date().getFullYear();

const labels = {
  overview: "Overview", pos: "Point of Sale", orders: "Orders",
  products: "Products", inventory: "Inventory", purchasing: "Purchasing",
  expenses: "Expenses", finance: "Finance", reports: "Reports",
  settings: "Settings"
};

function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function navigate(view) {
  const title = labels[view] || "Overview";
  document.querySelector("#breadcrumbTitle").textContent = title;
  document.querySelectorAll(".nav-link[data-view]").forEach(button =>
    button.classList.toggle("active", button.dataset.view === view)
  );
  document.querySelector("#sidebar").classList.remove("open");
  if (view !== "overview") {
    notify(title + " module is being prepared.");
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
document.querySelectorAll("[data-view]").forEach(button =>
  button.addEventListener("click", () => navigate(button.dataset.view))
);
document.querySelector("#mobileMenu").addEventListener("click", () =>
  document.querySelector("#sidebar").classList.toggle("open")
);

// Supabase connection is intentionally not initialized yet.
// Add the publishable/anon key only after confirming project settings.
// Never place a service_role key in browser code.
