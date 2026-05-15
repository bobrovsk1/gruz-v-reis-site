const languages = window.APP_LANGUAGES || {};
let currentLanguage = localStorage.getItem("gruzLanguage") || "ru";
let authToken = localStorage.getItem("gruzAuthToken") || "";

const t = (key) => languages[currentLanguage]?.[key] || languages.ru?.[key] || key;

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

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.querySelector("#language-select").value = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

function setDefaultDate() {
  const today = new Date();
  today.setDate(today.getDate() + 1);
  document.querySelector("#request-form").elements.date.valueAsDate = today;
}

document.querySelector("#language-select").addEventListener("change", (event) => {
  currentLanguage = event.target.value;
  localStorage.setItem("gruzLanguage", currentLanguage);
  applyLanguage();
});

document.querySelector("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());

  try {
    const payload = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(data)
    });
    localStorage.removeItem("gruzDraftRequest");
    showToast(currentLanguage === "ru" ? `Заявка ${payload.order.id} создана на сервере` : `Order ${payload.order.id} created on server`);
    event.currentTarget.reset();
    setDefaultDate();
  } catch (error) {
    localStorage.setItem("gruzDraftRequest", JSON.stringify(data));
    showToast(currentLanguage === "ru" ? "Сервер недоступен, черновик сохранен в браузере" : "Server unavailable, draft saved in browser");
  }
});

setDefaultDate();
applyLanguage();
