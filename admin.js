const adminStorageKey = "gruzAdmins";
const verificationStorageKey = "gruzVerificationRequests";

const roleLabels = {
  owner: "Главный админ",
  verifier: "Верификатор",
  support: "Поддержка"
};

const typeLabels = {
  company: "Компания",
  carrier: "Перевозчик",
  customer: "Заказчик"
};

const statusLabels = {
  pending: "На проверке",
  verified: "Проверен",
  rejected: "Отклонен"
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
  }
];

let verificationTypeFilter = "all";
let admins = loadCollection(adminStorageKey, defaultAdmins);
let verificationRequests = loadCollection(verificationStorageKey, defaultVerificationRequests);

function loadCollection(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : fallback.map((item) => ({ ...item }));
  } catch {
    return fallback.map((item) => ({ ...item }));
  }
}

function saveCollection(key, collection) {
  localStorage.setItem(key, JSON.stringify(collection));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  if (!digits) return "";
  const normalized = digits.startsWith("7") ? digits : `7${digits}`;
  const parts = [normalized.slice(1, 4), normalized.slice(4, 7), normalized.slice(7, 9), normalized.slice(9, 11)].filter(Boolean);
  if (parts.length === 1) return `+7 ${parts[0]}`;
  if (parts.length === 2) return `+7 ${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `+7 ${parts[0]} ${parts[1]}-${parts[2]}`;
  return `+7 ${parts[0]} ${parts[1]}-${parts[2]}-${parts[3]}`;
}

function makeInitials(name) {
  return (name || "АД")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "АД";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ru-RU");
}

function statusClass(status) {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
}

function renderMetrics() {
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
      <b class="chip neutral">${escapeHtml(roleLabels[admin.role] || roleLabels.verifier)}</b>
    `;
    return item;
  }));
}

function renderVerificationRequests() {
  const list = document.querySelector("#verification-list");
  const search = document.querySelector("#verification-search").value.trim().toLowerCase();
  const status = document.querySelector("#verification-status-filter").value;

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
    empty.textContent = "Нет заявок под выбранные фильтры";
    list.replaceChildren(empty);
    renderMetrics();
    return;
  }

  list.replaceChildren(...filtered.map((request) => {
    const isPending = request.status === "pending";
    const item = document.createElement("article");
    const decision = request.decisionAt
      ? `<small class="decision-line">Решение: ${escapeHtml(formatDate(request.decisionAt))} · ${escapeHtml(request.decisionBy)}</small>`
      : "";
    item.className = "verification-item";
    item.innerHTML = `
      <div class="verification-item-head">
        <div>
          <span class="chip neutral">${escapeHtml(typeLabels[request.type] || typeLabels.customer)}</span>
          <h3>${escapeHtml(request.name)}</h3>
          <small>${escapeHtml(request.id)} · подано ${escapeHtml(formatDate(request.submittedAt))}</small>
        </div>
        <b class="chip ${statusClass(request.status)}">${escapeHtml(statusLabels[request.status] || statusLabels.pending)}</b>
      </div>
      <dl class="verification-details">
        <div><dt>Контакт</dt><dd>${escapeHtml(request.contact)}</dd></div>
        <div><dt>Телефон</dt><dd>${escapeHtml(request.phone)}</dd></div>
        <div><dt>ИНН</dt><dd>${escapeHtml(request.inn)}</dd></div>
        <div><dt>Документы</dt><dd>${escapeHtml(request.docs)}</dd></div>
      </dl>
      ${decision}
      <div class="verification-actions">
        ${isPending
          ? `<button class="button primary small" type="button" data-verify-id="${escapeHtml(request.id)}" data-verify-action="approve">Верифицировать</button>
             <button class="button ghost small danger-button" type="button" data-verify-id="${escapeHtml(request.id)}" data-verify-action="reject">Отклонить</button>`
          : `<button class="button ghost small" type="button" data-verify-id="${escapeHtml(request.id)}" data-verify-action="reset">Вернуть на проверку</button>`}
      </div>
    `;
    return item;
  }));
  renderMetrics();
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

  saveCollection(verificationStorageKey, verificationRequests);
  renderVerificationRequests();
  showToast(`${request.name}: ${statusLabels[status]}`);
}

document.querySelector("#admin-form").elements.phone.addEventListener("input", (event) => {
  event.target.value = normalizePhone(event.target.value);
});

document.querySelector("#admin-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const phone = normalizePhone(data.get("phone"));

  if (phone.replace(/\D/g, "").length !== 11) {
    showToast("Введите телефон в формате +7 999 123-45-67");
    return;
  }

  if (admins.some((admin) => admin.phone === phone)) {
    showToast("Такой администратор уже добавлен");
    return;
  }

  admins.unshift({
    id: `ADM-${Date.now().toString().slice(-5)}`,
    name: data.get("name") || "Администратор",
    phone,
    role: data.get("role") || "verifier",
    createdAt: new Date().toISOString()
  });

  saveCollection(adminStorageKey, admins);
  event.currentTarget.reset();
  renderAdmins();
  renderMetrics();
  showToast("Администратор добавлен");
});

document.querySelector("#verification-search").addEventListener("input", renderVerificationRequests);
document.querySelector("#verification-status-filter").addEventListener("input", renderVerificationRequests);
document.querySelectorAll("[data-verify-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    verificationTypeFilter = button.dataset.verifyFilter;
    document.querySelectorAll("[data-verify-filter]").forEach((node) => {
      node.classList.toggle("is-active", node === button);
    });
    renderVerificationRequests();
  });
});

document.querySelector("#verification-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-verify-action]");
  if (!button) return;
  const status = button.dataset.verifyAction === "approve"
    ? "verified"
    : button.dataset.verifyAction === "reject"
      ? "rejected"
      : "pending";
  setVerificationStatus(button.dataset.verifyId, status);
});

renderAdmins();
renderVerificationRequests();
