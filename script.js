const languages = window.APP_LANGUAGES || {};
let currentLanguage = localStorage.getItem("gruzLanguage") || "ru";
let authMode = "login";
let authChannel = "sms";
let pendingUser = null;

const orders = [
  { id: "GV-1048", route: "Москва - Казань", cargo: "Паллеты, 1.2 т", vehicle: "tent", price: 78400, status: "responses", date: "2026-05-16" },
  { id: "GV-1047", route: "Самара - Уфа", cargo: "Оборудование, 4 т", vehicle: "ref", price: 96700, status: "checking", date: "2026-05-18" },
  { id: "GV-1046", route: "Пермь - Москва", cargo: "Сборный груз", vehicle: "gazelle", price: 112900, status: "draft", date: "2026-05-20" },
  { id: "GV-1045", route: "Краснодар - Ростов-на-Дону", cargo: "Продукты, 6 т", vehicle: "ref", price: 64200, status: "responses", date: "2026-05-21" },
  { id: "GV-1044", route: "Екатеринбург - Челябинск", cargo: "Металл, 12 т", vehicle: "tent", price: 58800, status: "checking", date: "2026-05-22" }
];

const carriers = [
  { name: "ТрансЛайн", city: "Москва", vehicles: "42 тента, 8 рефрижераторов", rating: "4.9", docs: "ИНН, договор, страховка", status: "Проверен" },
  { name: "Север Логистик", city: "Санкт-Петербург", vehicles: "18 фур, 12 газелей", rating: "4.8", docs: "ИНН, договор", status: "Проверен" },
  { name: "Волга Рейс", city: "Казань", vehicles: "24 тента, 5 бортовых", rating: "4.7", docs: "ИНН, страховка", status: "Новый" },
  { name: "Урал Карго", city: "Екатеринбург", vehicles: "31 фура, 6 рефрижераторов", rating: "4.9", docs: "ИНН, договор, акты", status: "Проверен" },
  { name: "ЮгТранс", city: "Краснодар", vehicles: "16 рефрижераторов", rating: "4.6", docs: "ИНН, договор", status: "Проверка" },
  { name: "Сибирский маршрут", city: "Новосибирск", vehicles: "29 тентов, 4 негабарита", rating: "4.8", docs: "ИНН, договор, страховка", status: "Проверен" }
];

let documents = [
  { name: "ИНН ООО ТрансЛайн.pdf", type: "inn", owner: "ТрансЛайн", date: "14.05.2026" },
  { name: "Договор GV-1048.docx", type: "contract", owner: "Груз в Рейс", date: "13.05.2026" },
  { name: "Акт выполненных работ.pdf", type: "act", owner: "Волга Рейс", date: "12.05.2026" },
  { name: "Страховка груза GV-1045.pdf", type: "insurance", owner: "ЮгТранс", date: "11.05.2026" }
];

const t = (key) => languages[currentLanguage]?.[key] || languages.ru?.[key] || key;
const money = (value) => new Intl.NumberFormat(currentLanguage === "ru" ? "ru-RU" : "en-US", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
}).format(value);

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.querySelector("#language-select").value = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const text = t(node.dataset.i18nTitle);
    node.title = text;
    node.setAttribute("aria-label", text);
  });
  setAuthMode(authMode);
  renderOrders();
  renderCarriers();
  renderDocuments();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

function setPage(page) {
  const normalized = document.querySelector(`[data-page="${page}"]`) ? page : "home";
  document.querySelectorAll("[data-page]").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.page === normalized);
  });
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.pageLink === normalized);
  });
}

function statusLabel(status) {
  if (status === "responses") return t("orders.statusResponses");
  if (status === "checking") return t("orders.statusChecking");
  return t("orders.statusDraft");
}

function vehicleLabel(vehicle) {
  if (vehicle === "ref") return t("vehicle.ref");
  if (vehicle === "gazelle") return t("vehicle.gazelle");
  return t("vehicle.tent");
}

function renderOrders() {
  const list = document.querySelector("#orders-list");
  const search = document.querySelector("#order-search")?.value.trim().toLowerCase() || "";
  const status = document.querySelector("#order-status")?.value || "all";
  const vehicle = document.querySelector("#order-vehicle")?.value || "all";
  const dateFrom = document.querySelector("#date-from")?.value || "";
  const dateTo = document.querySelector("#date-to")?.value || "";
  const minPrice = Number(document.querySelector("#min-price")?.value) || 0;
  const maxPrice = Number(document.querySelector("#max-price")?.value) || Infinity;

  const filtered = orders.filter((order) => {
    const haystack = `${order.id} ${order.route} ${order.cargo}`.toLowerCase();
    return (
      (!search || haystack.includes(search)) &&
      (status === "all" || order.status === status) &&
      (vehicle === "all" || order.vehicle === vehicle) &&
      (!dateFrom || order.date >= dateFrom) &&
      (!dateTo || order.date <= dateTo) &&
      order.price >= minPrice &&
      order.price <= maxPrice
    );
  });

  list.replaceChildren(...filtered.map((order) => {
    const row = document.createElement("div");
    row.className = "table-row";
    row.setAttribute("role", "row");
    row.innerHTML = `
      <span role="cell"><b>${order.route}</b><small>${order.id} · ${order.date}</small></span>
      <span role="cell">${order.cargo}</span>
      <span role="cell">${vehicleLabel(order.vehicle)}</span>
      <span role="cell">${money(order.price)}</span>
      <span role="cell"><b class="chip ${order.status === "responses" ? "success" : order.status === "checking" ? "warning" : "neutral"}">${statusLabel(order.status)}</b></span>
    `;
    return row;
  }));
}

function renderCarriers() {
  const list = document.querySelector("#carrier-list");
  list.replaceChildren(...carriers.map((carrier) => {
    const card = document.createElement("article");
    card.className = "carrier-card panel";
    card.innerHTML = `
      <div class="carrier-avatar">${carrier.name.slice(0, 2).toUpperCase()}</div>
      <div>
        <h2>${carrier.name}</h2>
        <p>${carrier.city} · ${carrier.vehicles}</p>
      </div>
      <div class="carrier-meta">
        <span class="chip success">★ ${carrier.rating}</span>
        <span class="chip neutral">${carrier.status}</span>
      </div>
      <small>${carrier.docs}</small>
    `;
    return card;
  }));
}

function renderDocuments() {
  const list = document.querySelector("#document-list");
  const search = document.querySelector("#document-search")?.value.trim().toLowerCase() || "";
  const type = document.querySelector("#document-type")?.value || "all";
  const filtered = documents.filter((doc) => {
    const haystack = `${doc.name} ${doc.owner}`.toLowerCase();
    return (!search || haystack.includes(search)) && (type === "all" || doc.type === type);
  });

  list.replaceChildren(...filtered.map((doc) => {
    const row = document.createElement("article");
    row.className = "document-row";
    row.innerHTML = `
      <span class="doc-icon" aria-hidden="true">PDF</span>
      <div>
        <strong>${doc.name}</strong>
        <small>${doc.owner} · ${doc.date}</small>
      </div>
      <button class="button ghost small" type="button">Открыть</button>
    `;
    return row;
  }));
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  if (!digits) return "";
  const normalized = digits.startsWith("7") ? digits : `7${digits}`;
  const parts = [normalized.slice(1, 4), normalized.slice(4, 7), normalized.slice(7, 9), normalized.slice(9, 11)].filter(Boolean);
  if (parts.length === 1) return `+7 ${parts[0]}`;
  if (parts.length === 2) return `+7 ${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `+7 ${parts[0]} ${parts[1]}-${parts[2]}`;
  return `+7 ${parts[0]} ${parts[1]}-${parts[2]}-${parts[3]}`;
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  document.querySelector("#register-fields").hidden = mode !== "register";
  document.querySelector("#auth-title").textContent = mode === "register" ? t("auth.registerTitle") : t("auth.loginTitle");
  document.querySelector("#auth-subtitle").textContent = mode === "register" ? t("auth.registerSubtitle") : t("auth.loginSubtitle");
}

function setAuthChannel(channel) {
  authChannel = channel;
  document.querySelectorAll("[data-channel]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.channel === channel);
  });
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  setAuthChannel("sms");
  document.querySelector("#auth-form").hidden = false;
  document.querySelector("#verify-form").hidden = true;
  document.querySelector("#auth-modal").hidden = false;
  document.querySelector("#auth-form").elements.phone.focus();
}

function closeAuth() {
  document.querySelector("#auth-modal").hidden = true;
}

function setProfile(user) {
  if (!user) return;
  document.querySelectorAll("[data-auth-open]").forEach((button) => {
    button.textContent = button.dataset.authModeOpen === "register" ? t("auth.profile") : t("auth.inCabinet");
  });
}

document.querySelector("#language-select").addEventListener("change", (event) => {
  currentLanguage = event.target.value;
  localStorage.setItem("gruzLanguage", currentLanguage);
  applyLanguage();
});

window.addEventListener("hashchange", () => setPage(location.hash.replace("#", "")));
document.querySelectorAll("[data-page-link]").forEach((link) => {
  link.addEventListener("click", () => setPage(link.dataset.pageLink));
});

["order-search", "order-status", "order-vehicle", "date-from", "date-to", "min-price", "max-price"].forEach((id) => {
  document.querySelector(`#${id}`)?.addEventListener("input", renderOrders);
});

document.querySelector("#reset-filters").addEventListener("click", () => {
  ["order-search", "date-from", "date-to", "min-price", "max-price"].forEach((id) => {
    document.querySelector(`#${id}`).value = "";
  });
  document.querySelector("#order-status").value = "all";
  document.querySelector("#order-vehicle").value = "all";
  renderOrders();
});

document.querySelector("#document-search").addEventListener("input", renderDocuments);
document.querySelector("#document-type").addEventListener("input", renderDocuments);
document.querySelector("#document-upload").addEventListener("change", (event) => {
  const uploaded = Array.from(event.target.files).map((file) => ({
    name: file.name,
    type: file.name.toLowerCase().includes("инн") ? "inn" : file.name.toLowerCase().includes("договор") ? "contract" : "act",
    owner: "Загружено пользователем",
    date: new Date().toLocaleDateString("ru-RU")
  }));
  documents = [...uploaded, ...documents];
  renderDocuments();
  showToast(`Добавлено файлов: ${uploaded.length}`);
});

document.querySelectorAll("[data-auth-open]").forEach((button) => {
  button.addEventListener("click", () => openAuth(button.dataset.authModeOpen || "login"));
});
document.querySelectorAll("[data-auth-close]").forEach((node) => node.addEventListener("click", closeAuth));
document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
document.querySelectorAll("[data-channel]").forEach((button) => button.addEventListener("click", () => setAuthChannel(button.dataset.channel)));

document.querySelector("#auth-form").elements.phone.addEventListener("input", (event) => {
  event.target.value = normalizePhone(event.target.value);
});

document.querySelector("#auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const phone = normalizePhone(data.get("phone") || "");
  if (phone.replace(/\D/g, "").length !== 11) {
    showToast("Введите номер телефона в формате +7 999 123-45-67");
    return;
  }
  pendingUser = {
    phone,
    name: data.get("name") || "Клиент",
    role: data.get("role") || "shipper"
  };
  event.currentTarget.hidden = true;
  document.querySelector("#verify-form").hidden = false;
  document.querySelector("#telegram-confirm").hidden = authChannel !== "telegram";
  document.querySelector("#verify-target").textContent =
    authChannel === "telegram" ? `Запрос отправлен в Telegram для ${phone}. Демо-код: 2486.` : `SMS-код отправлен на ${phone}. Демо-код: 2486.`;
});

document.querySelector("#verify-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.currentTarget.elements.code.value.trim() !== "2486") {
    showToast("Неверный код. Для демо используйте 2486.");
    return;
  }
  localStorage.setItem("gruzAuthUser", JSON.stringify(pendingUser));
  setProfile(pendingUser);
  closeAuth();
  showToast(`${authMode === "register" ? "Регистрация завершена" : "Вход выполнен"}: ${pendingUser.phone}`);
});

document.querySelector("#telegram-confirm").addEventListener("click", () => {
  localStorage.setItem("gruzAuthUser", JSON.stringify(pendingUser));
  setProfile(pendingUser);
  closeAuth();
  showToast(`Telegram подтвержден: ${pendingUser.phone}`);
});

document.querySelector("#back-to-phone").addEventListener("click", () => {
  document.querySelector("#auth-form").hidden = false;
  document.querySelector("#verify-form").hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAuth();
});

const savedUser = localStorage.getItem("gruzAuthUser");
if (savedUser) setProfile(JSON.parse(savedUser));

setPage(location.hash.replace("#", "") || "home");
applyLanguage();
