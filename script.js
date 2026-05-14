const routeForm = document.querySelector("#route-form");
const priceNode = document.querySelector("#quote-price");
const routeNode = document.querySelector("#quote-route");
const daysNode = document.querySelector("#quote-days");
const toast = document.querySelector("#toast");
const profilePreview = document.querySelector("#profile-preview");

const authModal = document.querySelector("#auth-modal");
const authForm = document.querySelector("#auth-form");
const verifyForm = document.querySelector("#verify-form");
const registerFields = document.querySelector("#register-fields");
const authTitle = document.querySelector("#auth-title");
const authSubtitle = document.querySelector("#auth-subtitle");
const verifyTarget = document.querySelector("#verify-target");
const telegramConfirm = document.querySelector("#telegram-confirm");
const backToPhone = document.querySelector("#back-to-phone");

const demoOtp = "2486";
let authMode = "login";
let authChannel = "sms";
let pendingUser = null;

const cities = {
  "Москва": [55.7558, 37.6173],
  "Санкт-Петербург": [59.9311, 30.3609],
  "Казань": [55.7961, 49.1064],
  "Нижний Новгород": [56.3269, 44.0059],
  "Екатеринбург": [56.8389, 60.6057],
  "Самара": [53.1959, 50.1008],
  "Новосибирск": [55.0084, 82.9357],
  "Краснодар": [45.0355, 38.9753],
  "Ростов-на-Дону": [47.2357, 39.7015],
  "Челябинск": [55.1644, 61.4368],
  "Пермь": [58.0105, 56.2502],
  "Уфа": [54.7388, 55.9721]
};

const cargoRates = {
  standard: 1,
  fragile: 1.14,
  food: 1.09,
  oversize: 1.28
};

const vehicleRates = {
  tent: 1,
  ref: 1.2,
  gazelle: 0.72,
  flatbed: 1.08
};

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(from, to) {
  const start = cities[from.trim()];
  const end = cities[to.trim()];

  if (!start || !end) {
    return null;
  }

  const radius = 6371;
  const dLat = toRadians(end[0] - start[0]);
  const dLon = toRadians(end[1] - start[1]);
  const lat1 = toRadians(start[0]);
  const lat2 = toRadians(end[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return Math.max(40, Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.22));
}

function money(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

function updateQuote() {
  const data = new FormData(routeForm);
  const from = data.get("from") || "";
  const to = data.get("to") || "";
  const route = distanceKm(from, to);
  const weight = Number(data.get("weight")) || 0;
  const volume = Number(data.get("volume")) || 0;

  if (!route || weight <= 0 || volume <= 0) {
    priceNode.textContent = "-";
    routeNode.textContent = "Проверьте города";
    daysNode.textContent = "-";
    return;
  }

  const paidWeight = Math.max(weight, volume * 250);
  const kmRate = paidWeight > 8000 ? 78 : paidWeight > 2500 ? 58 : 38;
  const base = 14500;
  const vehicleRate = vehicleRates[data.get("vehicle")] || 1;
  const cargoRate = cargoRates[data.get("cargo")] || 1;
  const expressRate = data.get("express") ? 1.18 : 1;
  const temperatureFee = data.get("temperature") ? Math.max(9000, route * 10) : 0;
  const insuranceFee = data.get("insurance") ? Math.max(3200, paidWeight * 1.8) : 0;
  const price = Math.round((base + route * kmRate + paidWeight * 4.6 + temperatureFee + insuranceFee) * vehicleRate * cargoRate * expressRate);
  const days = Math.max(1, Math.ceil(route / (data.get("express") ? 760 : 560)));

  priceNode.textContent = money(price);
  routeNode.textContent = `${route.toLocaleString("ru-RU")} км`;
  daysNode.textContent = `${days}-${days + 1} дн.`;
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  if (!digits) return "";

  const normalized = digits.startsWith("7") ? digits : `7${digits}`;
  const parts = [
    normalized.slice(1, 4),
    normalized.slice(4, 7),
    normalized.slice(7, 9),
    normalized.slice(9, 11)
  ].filter(Boolean);

  if (parts.length === 1) return `+7 ${parts[0]}`;
  if (parts.length === 2) return `+7 ${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `+7 ${parts[0]} ${parts[1]}-${parts[2]}`;
  return `+7 ${parts[0]} ${parts[1]}-${parts[2]}-${parts[3]}`;
}

function compactPhone(value) {
  return value.replace(/\D/g, "");
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  registerFields.hidden = mode !== "register";
  authTitle.textContent = mode === "register" ? "Регистрация по номеру телефона" : "Вход по номеру телефона";
  authSubtitle.textContent =
    mode === "register"
      ? "Создайте профиль и подтвердите номер через SMS или Telegram."
      : "Получите одноразовый код в SMS или подтвердите вход через Telegram.";
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
  authForm.hidden = false;
  verifyForm.hidden = true;
  authModal.hidden = false;
  authForm.elements.phone.focus();
}

function closeAuth() {
  authModal.hidden = true;
}

function setProfileContent(initials, name, subtitle) {
  const avatar = document.createElement("div");
  const text = document.createElement("div");
  const title = document.createElement("strong");
  const caption = document.createElement("small");

  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = initials;
  title.textContent = name;
  caption.textContent = subtitle;
  text.append(title, caption);
  profilePreview.replaceChildren(avatar, text);
}

function updateProfile(user) {
  if (!user) {
    setProfileContent("ГР", "Гость", "Войдите, чтобы сохранять маршруты");
    return;
  }

  setProfileContent(user.initials, user.name, `${user.phone} · номер подтвержден`);
  document.querySelectorAll("[data-auth-open]").forEach((button) => {
    button.textContent = button.dataset.authModeOpen === "register" ? "Профиль" : "В кабинете";
  });
}

function completeAuth() {
  const name = pendingUser?.name || "Клиент";
  const user = {
    name,
    phone: pendingUser.phone,
    role: pendingUser.role || "shipper",
    initials: name.trim().slice(0, 2).toUpperCase()
  };
  localStorage.setItem("gruzAuthUser", JSON.stringify(user));
  updateProfile(user);
  closeAuth();
  showToast(`${authMode === "register" ? "Регистрация завершена" : "Вход выполнен"}: ${user.phone}`);
}

routeForm.addEventListener("input", updateQuote);
routeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  showToast(`Заявка подготовлена. ${priceNode.textContent} будет передано менеджеру после авторизации.`);
  openAuth("login");
});

document.querySelectorAll("[data-auth-open]").forEach((button) => {
  button.addEventListener("click", () => openAuth(button.dataset.authModeOpen || "login"));
});

document.querySelectorAll("[data-auth-close]").forEach((node) => {
  node.addEventListener("click", closeAuth);
});

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

document.querySelectorAll("[data-channel]").forEach((button) => {
  button.addEventListener("click", () => setAuthChannel(button.dataset.channel));
});

authForm.elements.phone.addEventListener("input", (event) => {
  event.target.value = normalizePhone(event.target.value);
});

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(authForm);
  const phone = normalizePhone(data.get("phone") || "");

  if (compactPhone(phone).length !== 11) {
    showToast("Введите номер телефона в формате +7 999 123-45-67");
    return;
  }

  if (authMode === "register" && !data.get("consent")) {
    showToast("Для регистрации нужно согласие на обработку персональных данных");
    return;
  }

  pendingUser = {
    phone,
    name: data.get("name") || "Клиент",
    role: data.get("role") || "shipper",
    company: data.get("company") || ""
  };

  authForm.hidden = true;
  verifyForm.hidden = false;
  verifyForm.elements.code.value = "";
  telegramConfirm.hidden = authChannel !== "telegram";
  verifyTarget.textContent =
    authChannel === "telegram"
      ? `Запрос отправлен в Telegram для ${phone}. Демо-код: ${demoOtp}.`
      : `SMS-код отправлен на ${phone}. Демо-код: ${demoOtp}.`;
  verifyForm.elements.code.focus();
});

verifyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = verifyForm.elements.code.value.trim();

  if (code !== demoOtp) {
    showToast("Неверный код подтверждения. Для демо используйте 2486.");
    return;
  }

  completeAuth();
});

telegramConfirm.addEventListener("click", completeAuth);

backToPhone.addEventListener("click", () => {
  authForm.hidden = false;
  verifyForm.hidden = true;
  authForm.elements.phone.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !authModal.hidden) closeAuth();
});

const savedUser = localStorage.getItem("gruzAuthUser");
if (savedUser) {
  updateProfile(JSON.parse(savedUser));
}

const today = new Date();
today.setDate(today.getDate() + 1);
routeForm.elements.date.valueAsDate = today;
updateQuote();
