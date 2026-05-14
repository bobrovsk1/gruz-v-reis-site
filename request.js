const languages = window.APP_LANGUAGES || {};
let currentLanguage = localStorage.getItem("gruzLanguage") || "ru";

const t = (key) => languages[currentLanguage]?.[key] || languages.ru?.[key] || key;

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

document.querySelector("#language-select").addEventListener("change", (event) => {
  currentLanguage = event.target.value;
  localStorage.setItem("gruzLanguage", currentLanguage);
  applyLanguage();
});

document.querySelector("#request-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  localStorage.setItem("gruzDraftRequest", JSON.stringify(data));
  showToast(currentLanguage === "ru" ? "Шаблон заявки сохранен в браузере" : "Order template saved in browser");
});

const today = new Date();
today.setDate(today.getDate() + 1);
document.querySelector("#request-form").elements.date.valueAsDate = today;
applyLanguage();
