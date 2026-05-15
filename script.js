const languages = window.APP_LANGUAGES || {};
let currentLanguage = localStorage.getItem("gruzLanguage") || "ru";
let authMode = "login";
let authChannel = "sms";
let pendingUser = null;
let currentUser = null;
let authToken = localStorage.getItem("gruzAuthToken") || "";

let orders = [
  { id: "GV-1048", route: "Москва - Казань", cargo: "Паллеты, 1.2 т", vehicle: "tent", price: 78400, status: "responses", date: "2026-05-16" },
  { id: "GV-1047", route: "Самара - Уфа", cargo: "Оборудование, 4 т", vehicle: "ref", price: 96700, status: "checking", date: "2026-05-18" },
  { id: "GV-1046", route: "Пермь - Москва", cargo: "Сборный груз", vehicle: "gazelle", price: 112900, status: "draft", date: "2026-05-20" },
  { id: "GV-1045", route: "Краснодар - Ростов-на-Дону", cargo: "Продукты, 6 т", vehicle: "ref", price: 64200, status: "responses", date: "2026-05-21" },
  { id: "GV-1044", route: "Екатеринбург - Челябинск", cargo: "Металл, 12 т", vehicle: "tent", price: 58800, status: "checking", date: "2026-05-22" }
];

let carriers = [
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

const adminStorageKey = "gruzAdmins";
const verificationStorageKey = "gruzVerificationRequests";
const adminRoleKeys = {
  owner: "admin.roleOwner",
  verifier: "admin.roleVerifier",
  support: "admin.roleSupport"
};
const verificationTypeKeys = {
  company: "admin.typeCompany",
  carrier: "admin.typeCarrier",
  customer: "admin.typeCustomer"
};
const verificationStatusKeys = {
  pending: "admin.statusPending",
  verified: "admin.statusVerified",
  rejected: "admin.statusRejected"
};

const defaultAdmins = [
  { id: "ADM-001", name: "Главный администратор", phone: "+7 900 100-20-30", role: "owner", createdAt: "2026-05-14" },
  { id: "ADM-002", name: "Мария Кузнецова", phone: "+7 911 222-33-44", role: "verifier", createdAt: "2026-05-14" }
];

const defaultVerificationRequests = [
  {
    id: "VR-2101",
    type: "company",
    name: "ООО СеверСнаб",
    contact: "Илья Морозов",
    phone: "+7 921 340-45-67",
    inn: "7801456721",
    docs: "ИНН, карточка компании, доверенность",
    submittedAt: "2026-05-14",
    status: "pending"
  },
  {
    id: "VR-2102",
    type: "carrier",
    name: "ИП Павлов Артем",
    contact: "Артем Павлов",
    phone: "+7 905 180-28-44",
    inn: "504512345678",
    docs: "Паспорт ТС, страховка, ИНН",
    submittedAt: "2026-05-14",
    status: "pending"
  },
  {
    id: "VR-2103",
    type: "customer",
    name: "ООО ФрешМаркет",
    contact: "Елена Соколова",
    phone: "+7 926 777-12-88",
    inn: "7708123400",
    docs: "ИНН, договор, контактное лицо",
    submittedAt: "2026-05-13",
    status: "verified",
    decisionAt: "2026-05-14",
    decisionBy: "Мария Кузнецова"
  },
  {
    id: "VR-2104",
    type: "carrier",
    name: "Восток Карго",
    contact: "Денис Белов",
    phone: "+7 913 552-18-77",
    inn: "5402234581",
    docs: "ИНН, договор без подписи",
    submittedAt: "2026-05-12",
    status: "rejected",
    decisionAt: "2026-05-13",
    decisionBy: "Главный администратор"
  }
];

let verificationTypeFilter = "all";
let admins = loadStoredCollection(adminStorageKey, defaultAdmins);
let verificationRequests = loadStoredCollection(verificationStorageKey, defaultVerificationRequests);

const t = (key) => languages[currentLanguage]?.[key] || languages.ru?.[key] || key;
const money = (value) => new Intl.NumberFormat(currentLanguage === "ru" ? "ru-RU" : "en-US", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
}).format(value);

const htmlEntities = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

function loadStoredCollection(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : fallback.map((item) => ({ ...item }));
  } catch {
    return fallback.map((item) => ({ ...item }));
  }
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Ошибка сервера");
  }

  return payload;
}

async function loadBackendState() {
  try {
    const [ordersPayload, carriersPayload, documentsPayload] = await Promise.all([
      api("/api/orders"),
      api("/api/carriers"),
      api("/api/documents")
    ]);

    orders = ordersPayload.orders || orders;
    carriers = carriersPayload.carriers || carriers;
    documents = documentsPayload.documents || documents;
    renderOrders();
    renderCarriers();
    renderDocuments();
  } catch (error) {
    console.warn("Backend data is unavailable, using local demo data.", error);
  }

  if (!authToken) return;

  try {
    const profile = await api("/api/profile");
    saveUser(profile.user);
  } catch (error) {
    console.warn("Saved session is unavailable.", error);
  }
}

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
  renderAdminPanel();
  if (currentUser) renderProfileSummary(currentUser);
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
    const orderUser = order.user || {
      name: order.status === "draft" ? "Иван Петров" : order.status === "checking" ? "Анна Смирнова" : "Олег Орлов",
      company: order.status === "draft" ? "ООО Склад Север" : order.status === "checking" ? "ТК Восток" : "ТрансЛайн",
      verified: order.status !== "draft"
    };
    const row = document.createElement("div");
    row.className = "table-row";
    row.setAttribute("role", "row");
    row.innerHTML = `
      <span role="cell"><b>${escapeHtml(order.route)}</b><small>${escapeHtml(order.id)} · ${escapeHtml(order.date)}</small></span>
      <span role="cell">${escapeHtml(order.cargo)}</span>
      <span role="cell">${vehicleLabel(order.vehicle)}</span>
      <span role="cell">${money(order.price)}</span>
      <span role="cell"><b>${escapeHtml(orderUser.name)}</b><small>${escapeHtml(orderUser.company)}</small></span>
      <span role="cell"><b class="chip ${orderUser.verified ? "success" : "warning"}">${orderUser.verified ? t("profile.verifiedStatus") : t("profile.notVerifiedStatus")}</b></span>
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
      <div class="carrier-avatar">${escapeHtml(carrier.name.slice(0, 2).toUpperCase())}</div>
      <div>
        <h2>${escapeHtml(carrier.name)}</h2>
        <p>${escapeHtml(carrier.city)} · ${escapeHtml(carrier.vehicles)}</p>
      </div>
      <div class="carrier-meta">
        <span class="chip success">★ ${escapeHtml(carrier.rating)}</span>
        <span class="chip neutral">${escapeHtml(carrier.status)}</span>
      </div>
      <small>${escapeHtml(carrier.docs)}</small>
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
        <strong>${escapeHtml(doc.name)}</strong>
        <small>${escapeHtml(doc.owner)} · ${escapeHtml(doc.date)}</small>
      </div>
      <button class="button ghost small" type="button">Открыть</button>
    `;
    return row;
  }));
}

function persistAdmins() {
  localStorage.setItem(adminStorageKey, JSON.stringify(admins));
}

function persistVerificationRequests() {
  localStorage.setItem(verificationStorageKey, JSON.stringify(verificationRequests));
}

function adminRoleLabel(role) {
  return t(adminRoleKeys[role] || "admin.roleVerifier");
}

function verificationTypeLabel(type) {
  return t(verificationTypeKeys[type] || "admin.typeCustomer");
}

function verificationStatusLabel(status) {
  return t(verificationStatusKeys[status] || "admin.statusPending");
}

function verificationStatusClass(status) {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function verificationTypeFromRole(role) {
  if (role === "carrier") return "carrier";
  if (role === "shipper") return "customer";
  return "company";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(currentLanguage === "ru" ? "ru-RU" : "en-US");
}

function renderAdminPanel() {
  if (!document.querySelector("#admin-list")) return;
  renderAdminMetrics();
  renderAdmins();
  renderVerificationRequests();
}

function renderAdminMetrics() {
  document.querySelector("#admin-pending-count").textContent = verificationRequests.filter((item) => item.status === "pending").length;
  document.querySelector("#admin-verified-count").textContent = verificationRequests.filter((item) => item.status === "verified").length;
  document.querySelector("#admin-count").textContent = admins.length;
}

function renderAdmins() {
  const list = document.querySelector("#admin-list");
  list.replaceChildren(...admins.map((admin) => {
    const item = document.createElement("article");
    item.className = "admin-person";
    item.innerHTML = `
      <span class="profile-avatar">${escapeHtml(makeInitials(admin.name))}</span>
      <div>
        <strong>${escapeHtml(admin.name)}</strong>
        <small>${escapeHtml(admin.phone)} · ${escapeHtml(formatDate(admin.createdAt))}</small>
      </div>
      <b class="chip neutral">${escapeHtml(adminRoleLabel(admin.role))}</b>
    `;
    return item;
  }));
}

function renderVerificationRequests() {
  const list = document.querySelector("#verification-list");
  const search = document.querySelector("#verification-search")?.value.trim().toLowerCase() || "";
  const status = document.querySelector("#verification-status-filter")?.value || "all";

  const filtered = verificationRequests.filter((request) => {
    const haystack = `${request.id} ${request.name} ${request.contact} ${request.phone} ${request.inn} ${request.docs}`.toLowerCase();
    return (
      (verificationTypeFilter === "all" || request.type === verificationTypeFilter) &&
      (status === "all" || request.status === status) &&
      (!search || haystack.includes(search))
    );
  });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("admin.emptyQueue");
    list.replaceChildren(empty);
    renderAdminMetrics();
    return;
  }

  list.replaceChildren(...filtered.map((request) => {
    const item = document.createElement("article");
    const isPending = request.status === "pending";
    const decision = request.decisionAt
      ? `<small class="decision-line">${escapeHtml(t("admin.decision"))} ${escapeHtml(formatDate(request.decisionAt))} · ${escapeHtml(request.decisionBy)}</small>`
      : "";
    item.className = "verification-item";
    item.innerHTML = `
      <div class="verification-item-head">
        <div>
          <span class="chip neutral">${escapeHtml(verificationTypeLabel(request.type))}</span>
          <h3>${escapeHtml(request.name)}</h3>
          <small>${escapeHtml(request.id)} · ${escapeHtml(t("admin.submittedAt"))} ${escapeHtml(formatDate(request.submittedAt))}</small>
        </div>
        <b class="chip ${verificationStatusClass(request.status)}">${escapeHtml(verificationStatusLabel(request.status))}</b>
      </div>
      <dl class="verification-details">
        <div><dt>${escapeHtml(t("admin.contact"))}</dt><dd>${escapeHtml(request.contact)}</dd></div>
        <div><dt>${escapeHtml(t("admin.phone"))}</dt><dd>${escapeHtml(request.phone)}</dd></div>
        <div><dt>${escapeHtml(t("admin.inn"))}</dt><dd>${escapeHtml(request.inn)}</dd></div>
        <div><dt>${escapeHtml(t("admin.docs"))}</dt><dd>${escapeHtml(request.docs)}</dd></div>
      </dl>
      ${decision}
      <div class="verification-actions">
        ${isPending
          ? `<button class="button primary small" type="button" data-verify-id="${escapeHtml(request.id)}" data-verify-action="approve">${escapeHtml(t("admin.approve"))}</button>
             <button class="button ghost small danger-button" type="button" data-verify-id="${escapeHtml(request.id)}" data-verify-action="reject">${escapeHtml(t("admin.reject"))}</button>`
          : `<button class="button ghost small" type="button" data-verify-id="${escapeHtml(request.id)}" data-verify-action="reset">${escapeHtml(t("admin.returnToCheck"))}</button>`}
      </div>
    `;
    return item;
  }));
  renderAdminMetrics();
}

function queueUserVerification(user) {
  if (!user?.phone || !user?.company?.trim()) return;
  const type = verificationTypeFromRole(user.role);
  const existing = verificationRequests.find((request) => request.phone === user.phone);
  const payload = {
    type,
    name: user.company.trim(),
    contact: user.name || "Клиент",
    phone: user.phone,
    inn: "указать в документах",
    docs: "Профиль, подтвержденный телефон",
    submittedAt: new Date().toISOString().slice(0, 10)
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    verificationRequests.unshift({
      id: `VR-${Date.now().toString().slice(-5)}`,
      status: "pending",
      ...payload
    });
  }

  persistVerificationRequests();
  renderAdminPanel();
}

function setVerificationStatus(id, status) {
  const request = verificationRequests.find((item) => item.id === id);
  if (!request) return;

  request.status = status;
  if (status === "pending") {
    delete request.decisionAt;
    delete request.decisionBy;
  } else {
    request.decisionAt = new Date().toISOString();
    request.decisionBy = admins[0]?.name || "Администратор";
  }

  if (currentUser?.phone === request.phone) {
    currentUser.companyVerified = status === "verified";
    localStorage.setItem("gruzAuthUser", JSON.stringify(currentUser));
  }

  persistVerificationRequests();
  renderAdminPanel();
  showToast(`${request.name}: ${verificationStatusLabel(status)}`);
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

function makeInitials(name) {
  return (name || "Клиент")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "КЛ";
}

function companyLabel(company) {
  return company?.trim() || (currentLanguage === "ru" ? "Компания не указана" : "Company not set");
}

function saveUser(user, token = authToken) {
  if (token) {
    authToken = token;
    localStorage.setItem("gruzAuthToken", token);
  }

  currentUser = {
    id: user.id || currentUser?.id || "",
    name: user.name || "Клиент",
    company: user.company || "",
    companyInn: user.companyInn || currentUser?.companyInn || "",
    companyVerified: user.companyVerified ?? currentUser?.companyVerified ?? false,
    companyUsers: user.companyUsers || currentUser?.companyUsers || [],
    role: user.role || "shipper",
    phone: user.phone || "",
    verified: user.verified !== false,
    verifiedBy: user.verifiedBy || authChannel || "sms",
    verifiedAt: user.verifiedAt || new Date().toISOString()
  };
  queueUserVerification(currentUser);
  const verification = verificationRequests.find((request) => request.phone === currentUser.phone);
  if (verification) currentUser.companyVerified = verification.status === "verified";
  localStorage.setItem("gruzAuthUser", JSON.stringify(currentUser));
  renderProfileSummary(currentUser);
}

function renderProfileSummary(user) {
  const button = document.querySelector("#profile-button");
  button.hidden = false;
  document.querySelector("#profile-avatar").textContent = makeInitials(user.name);
  document.querySelector("#profile-name").textContent = user.name || "Клиент";
  document.querySelector("#profile-company").textContent = companyLabel(user.company);
  document.querySelectorAll("[data-auth-open]").forEach((authButton) => {
    authButton.hidden = true;
  });
}

function openProfile() {
  if (!currentUser) return;
  const form = document.querySelector("#profile-form");
  form.elements.name.value = currentUser.name || "";
  form.elements.company.value = currentUser.company || "";
  form.elements.companyInn.value = currentUser.companyInn || "";
  form.elements.role.value = currentUser.role || "shipper";
  form.elements.phone.value = currentUser.phone || "";
  document.querySelector("#verification-title").textContent = currentUser.verified ? t("profile.verifiedTitle") : t("profile.notVerifiedTitle");
  document.querySelector("#verification-details").textContent = currentUser.verified
    ? `${t("profile.verifiedBy")} ${currentUser.verifiedBy === "telegram" ? "Telegram" : "SMS"}`
    : t("profile.notVerifiedDetails");
  document.querySelector("#verification-status").textContent = currentUser.verified ? t("profile.verifiedStatus") : t("profile.notVerifiedStatus");
  document.querySelector("#verification-status").className = `chip ${currentUser.verified ? "success" : "warning"}`;
  document.querySelector("#company-verification-title").textContent = currentUser.companyVerified ? t("profile.companyVerifiedTitle") : t("profile.companyNotVerifiedTitle");
  document.querySelector("#company-verification-details").textContent = currentUser.companyVerified ? t("profile.companyVerifiedDetails") : t("profile.companyNotVerifiedDetails");
  document.querySelector("#company-verification-status").textContent = currentUser.companyVerified ? t("profile.companyVerifiedStatus") : t("profile.companyNotVerifiedStatus");
  document.querySelector("#company-verification-status").className = `chip ${currentUser.companyVerified ? "success" : "warning"}`;
  renderCompanyUsers();
  document.querySelector("#profile-modal").hidden = false;
}

function closeProfile() {
  document.querySelector("#profile-modal").hidden = true;
}

function renderCompanyUsers() {
  const list = document.querySelector("#company-user-list");
  const users = currentUser?.companyUsers || [];
  if (!users.length) {
    const empty = document.createElement("div");
    empty.className = "company-user-row";
    empty.innerHTML = `<div><strong>${t("profile.noUsers")}</strong><small>${t("profile.noUsersHint")}</small></div>`;
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...users.map((user) => {
    const row = document.createElement("article");
    row.className = "company-user-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <small>${escapeHtml(user.phone)} · ${escapeHtml(companyLabel(currentUser.company))}</small>
      </div>
      <span>${escapeHtml(companyUserRoleLabel(user.role))}</span>
      <b class="chip ${user.verified ? "success" : "warning"}">${user.verified ? t("profile.verifiedStatus") : t("profile.notVerifiedStatus")}</b>
    `;
    return row;
  }));
}

function companyUserRoleLabel(role) {
  if (role === "logist") return t("profile.userRoleLogist");
  if (role === "accountant") return t("profile.userRoleAccountant");
  return t("profile.userRoleManager");
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
  saveUser(user);
}

document.querySelector("#language-select").addEventListener("change", (event) => {
  currentLanguage = event.target.value;
  localStorage.setItem("gruzLanguage", currentLanguage);
  applyLanguage();
});

window.addEventListener("hashchange", () => setPage(location.hash.replace("#", "")));
document.querySelectorAll("[data-page-link]").forEach((link) => {
  link.addEventListener("click", () => {
    setPage(link.dataset.pageLink);
    link.blur();
    document.querySelector(".app-main").focus({ preventScroll: true });
  });
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
document.querySelector("#document-upload").addEventListener("change", async (event) => {
  const uploaded = Array.from(event.target.files).map((file) => ({
    name: file.name,
    type: file.name.toLowerCase().includes("инн") ? "inn" : file.name.toLowerCase().includes("договор") ? "contract" : "act",
    owner: "Загружено пользователем",
    date: new Date().toLocaleDateString("ru-RU")
  }));

  if (!uploaded.length) return;

  let message = `Добавлено файлов: ${uploaded.length}`;
  try {
    const payload = await api("/api/documents", {
      method: "POST",
      body: JSON.stringify({ documents: uploaded })
    });
    documents = [...(payload.documents || uploaded), ...documents];
  } catch (error) {
    documents = [...uploaded, ...documents];
    message = `${message}. Сервер недоступен, список обновлен локально.`;
  }

  renderDocuments();
  showToast(message);
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

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
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
    role: data.get("role") || "shipper",
    company: data.get("company") || ""
  };

  try {
    const payload = await api("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ ...pendingUser, mode: authMode, channel: authChannel })
    });
    event.currentTarget.hidden = true;
    document.querySelector("#verify-form").hidden = false;
    document.querySelector("#telegram-confirm").hidden = authChannel !== "telegram";
    document.querySelector("#verify-target").textContent = payload.message;
  } catch (error) {
    showToast(error.message);
  }
});

async function confirmAuth(code, channel = authChannel) {
  if (!pendingUser) {
    showToast("Сначала запросите код подтверждения.");
    return;
  }

  try {
    const payload = await api("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ ...pendingUser, channel, code })
    });
    saveUser(payload.user, payload.token);
    closeAuth();
    showToast(`${authMode === "register" ? "Регистрация завершена" : "Вход выполнен"}: ${pendingUser.phone}`);
  } catch (error) {
    showToast(error.message);
  }
}

document.querySelector("#verify-form").addEventListener("submit", (event) => {
  event.preventDefault();
  confirmAuth(event.currentTarget.elements.code.value.trim());
});

document.querySelector("#telegram-confirm").addEventListener("click", () => {
  confirmAuth("2486", "telegram");
});

document.querySelector("#back-to-phone").addEventListener("click", () => {
  document.querySelector("#auth-form").hidden = false;
  document.querySelector("#verify-form").hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAuth();
    closeProfile();
  }
});

const savedUser = localStorage.getItem("gruzAuthUser");
if (savedUser) setProfile(JSON.parse(savedUser));

document.querySelector("#profile-button").addEventListener("click", openProfile);
document.querySelectorAll("[data-profile-close]").forEach((node) => node.addEventListener("click", closeProfile));
document.querySelector("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const nextUser = {
    ...currentUser,
    name: data.get("name"),
    company: data.get("company"),
    companyInn: data.get("companyInn"),
    role: data.get("role")
  };

  let message = t("profile.saved");
  try {
    const payload = authToken
      ? await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(nextUser)
      })
      : { user: nextUser };
    saveUser(payload.user);
  } catch (error) {
    saveUser(nextUser);
    message = `${t("profile.saved")}. Сервер недоступен, изменения сохранены в браузере.`;
  }

  closeProfile();
  showToast(message);
});

document.querySelector("#company-user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const nextCompanyUser = {
    name: data.get("name"),
    phone: normalizePhone(data.get("phone") || ""),
    role: data.get("role"),
    verified: true
  };
  const nextUser = {
    ...currentUser,
    companyUsers: [...(currentUser?.companyUsers || []), nextCompanyUser]
  };

  try {
    const payload = authToken
      ? await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(nextUser)
      })
      : { user: nextUser };
    saveUser(payload.user);
  } catch {
    saveUser(nextUser);
  }

  event.currentTarget.reset();
  renderCompanyUsers();
  showToast(t("profile.userAdded"));
});

setPage(location.hash.replace("#", "") || "home");
applyLanguage();
loadBackendState();
