const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const port = Number(process.env.PORT || 4173);
const demoCode = process.env.DEMO_OTP || "2486";
const jsonLimitBytes = 1024 * 1024;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const seeds = {
  orders: [
    { id: "GV-1048", route: "Москва - Казань", cargo: "Паллеты, 1.2 т", vehicle: "tent", price: 78400, status: "responses", date: "2026-05-16" },
    { id: "GV-1047", route: "Самара - Уфа", cargo: "Оборудование, 4 т", vehicle: "ref", price: 96700, status: "checking", date: "2026-05-18" },
    { id: "GV-1046", route: "Пермь - Москва", cargo: "Сборный груз", vehicle: "gazelle", price: 112900, status: "draft", date: "2026-05-20" },
    { id: "GV-1045", route: "Краснодар - Ростов-на-Дону", cargo: "Продукты, 6 т", vehicle: "ref", price: 64200, status: "responses", date: "2026-05-21" },
    { id: "GV-1044", route: "Екатеринбург - Челябинск", cargo: "Металл, 12 т", vehicle: "tent", price: 58800, status: "checking", date: "2026-05-22" }
  ],
  carriers: [
    { name: "ТрансЛайн", city: "Москва", vehicles: "42 тента, 8 рефрижераторов", rating: "4.9", docs: "ИНН, договор, страховка", status: "Проверен" },
    { name: "Север Логистик", city: "Санкт-Петербург", vehicles: "18 фур, 12 газелей", rating: "4.8", docs: "ИНН, договор", status: "Проверен" },
    { name: "Волга Рейс", city: "Казань", vehicles: "24 тента, 5 бортовых", rating: "4.7", docs: "ИНН, страховка", status: "Новый" },
    { name: "Урал Карго", city: "Екатеринбург", vehicles: "31 фура, 6 рефрижераторов", rating: "4.9", docs: "ИНН, договор, акты", status: "Проверен" },
    { name: "ЮгТранс", city: "Краснодар", vehicles: "16 рефрижераторов", rating: "4.6", docs: "ИНН, договор", status: "Проверка" },
    { name: "Сибирский маршрут", city: "Новосибирск", vehicles: "29 тентов, 4 негабарита", rating: "4.8", docs: "ИНН, договор, страховка", status: "Проверен" }
  ],
  documents: [
    { id: "DOC-1004", name: "ИНН ООО ТрансЛайн.pdf", type: "inn", owner: "ТрансЛайн", date: "14.05.2026" },
    { id: "DOC-1003", name: "Договор GV-1048.docx", type: "contract", owner: "Груз в Рейс", date: "13.05.2026" },
    { id: "DOC-1002", name: "Акт выполненных работ.pdf", type: "act", owner: "Волга Рейс", date: "12.05.2026" },
    { id: "DOC-1001", name: "Страховка груза GV-1045.pdf", type: "insurance", owner: "ЮгТранс", date: "11.05.2026" }
  ],
  users: [],
  codes: [],
  sessions: []
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  });
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function sendError(res, status, message, details = null) {
  sendJson(res, status, { ok: false, error: message, details });
}

async function ensureStore(name) {
  await fs.mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, `${name}.json`);

  if (!fsSync.existsSync(file)) {
    await fs.writeFile(file, JSON.stringify(seeds[name] || [], null, 2), "utf8");
  }
}

async function readStore(name) {
  await ensureStore(name);
  const file = path.join(dataDir, `${name}.json`);
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${name}.json: ${error.message}`);
  }
}

async function writeStore(name, data) {
  await ensureStore(name);
  const file = path.join(dataDir, `${name}.json`);
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temporary, file);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > jsonLimitBytes) {
      throw Object.assign(new Error("Request body is too large"), { status: 413 });
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  if (!digits) return "";
  return digits.startsWith("7") ? digits : `7${digits}`;
}

function displayPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length !== 11) return value || "";
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

function text(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

function moneyEstimate(payload) {
  const weight = Math.max(Number(payload.weight) || 1000, 1);
  const volume = Math.max(Number(payload.volume) || 6, 1);
  const vehicle = mapVehicle(payload.vehicle);
  const vehicleRate = vehicle === "ref" ? 1.3 : vehicle === "gazelle" ? 0.72 : 1;
  return Math.round((45000 + weight * 9 + volume * 1200) * vehicleRate / 100) * 100;
}

function mapVehicle(value) {
  const vehicle = String(value || "").toLowerCase();
  if (vehicle.includes("реф") || vehicle.includes("ref")) return "ref";
  if (vehicle.includes("газ") || vehicle.includes("gazelle") || vehicle.includes("van")) return "gazelle";
  return "tent";
}

function nextNumberedId(items, prefix) {
  const next = items.reduce((max, item) => {
    const match = String(item.id || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000) + 1;

  return `${prefix}-${String(next).padStart(4, "0")}`;
}

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function inferDocumentType(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("инн") || normalized.includes("inn")) return "inn";
  if (normalized.includes("договор") || normalized.includes("contract")) return "contract";
  if (normalized.includes("страх") || normalized.includes("insurance")) return "insurance";
  return "act";
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    company: user.company,
    companyInn: user.companyInn || "",
    companyVerified: user.companyVerified === true,
    companyUsers: normalizeCompanyUsers(user.companyUsers),
    role: user.role,
    phone: displayPhone(user.phone),
    verified: Boolean(user.verified),
    verifiedBy: user.verifiedBy || "sms",
    verifiedAt: user.verifiedAt
  };
}

function normalizeCompanyUsers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: text(item.name, 80),
      phone: displayPhone(normalizePhone(item.phone)),
      role: text(item.role, 40) || "manager",
      verified: item.verified !== false
    }))
    .filter((item) => item.name || item.phone);
}

async function getCurrentUser(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const [sessions, users] = await Promise.all([readStore("sessions"), readStore("users")]);
  const session = sessions.find((item) => item.token === token);
  if (!session) return null;

  return users.find((user) => user.id === session.userId) || null;
}

async function handleAuthRequest(req, res) {
  const body = await readJson(req);
  const phone = normalizePhone(body.phone);
  const channel = body.channel === "telegram" ? "telegram" : "sms";
  const mode = body.mode === "register" ? "register" : "login";

  if (phone.length !== 11) {
    sendError(res, 422, "Введите номер телефона в формате +7 999 123-45-67.");
    return;
  }

  const codes = (await readStore("codes")).filter((item) => item.phone !== phone && Date.parse(item.expiresAt) > Date.now());
  codes.push({
    phone,
    code: demoCode,
    channel,
    mode,
    name: text(body.name, 80) || "Клиент",
    company: text(body.company, 120),
    companyInn: text(body.companyInn, 20),
    role: text(body.role, 30) || "shipper",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });
  await writeStore("codes", codes);

  sendJson(res, 200, {
    ok: true,
    phone: displayPhone(phone),
    channel,
    expiresIn: 600,
    demoCode,
    message: channel === "telegram"
      ? `Запрос отправлен в Telegram для ${displayPhone(phone)}. Demo-код: ${demoCode}.`
      : `SMS-код отправлен на ${displayPhone(phone)}. Demo-код: ${demoCode}.`
  });
}

async function handleAuthVerify(req, res) {
  const body = await readJson(req);
  const phone = normalizePhone(body.phone);
  const enteredCode = text(body.code, 12);
  const codes = await readStore("codes");
  const pending = [...codes]
    .reverse()
    .find((item) => item.phone === phone && Date.parse(item.expiresAt) > Date.now());

  if (!pending || pending.code !== enteredCode) {
    sendError(res, 401, "Неверный или просроченный код подтверждения.");
    return;
  }

  const now = new Date().toISOString();
  const users = await readStore("users");
  let user = users.find((item) => item.phone === phone);

  if (!user) {
    user = {
      id: `user_${crypto.randomBytes(8).toString("hex")}`,
      phone,
      createdAt: now
    };
    users.push(user);
  }

  user.name = text(body.name || pending.name, 80) || user.name || "Клиент";
  user.company = text(body.company || pending.company, 120);
  user.companyInn = text(body.companyInn || pending.companyInn || user.companyInn, 20);
  user.companyVerified = Boolean(body.companyVerified ?? user.companyVerified);
  user.companyUsers = normalizeCompanyUsers(body.companyUsers || user.companyUsers);
  user.role = text(body.role || pending.role, 30) || "shipper";
  user.verified = true;
  user.verifiedBy = pending.channel;
  user.verifiedAt = now;
  user.updatedAt = now;

  const sessions = await readStore("sessions");
  const token = makeToken();
  sessions.push({ token, userId: user.id, createdAt: now });

  await Promise.all([
    writeStore("users", users),
    writeStore("sessions", sessions),
    writeStore("codes", codes.filter((item) => item.phone !== phone))
  ]);

  sendJson(res, 200, { ok: true, user: serializeUser(user), token });
}

async function handleProfile(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    sendError(res, 401, "Нужно войти в кабинет.");
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, { ok: true, user: serializeUser(user) });
    return;
  }

  const body = await readJson(req);
  const users = await readStore("users");
  const stored = users.find((item) => item.id === user.id);

  stored.name = text(body.name, 80) || stored.name;
  stored.company = text(body.company, 120);
  stored.companyInn = text(body.companyInn, 20) || stored.companyInn || "";
  stored.companyVerified = Boolean(body.companyVerified ?? stored.companyVerified);
  stored.companyUsers = "companyUsers" in body
    ? normalizeCompanyUsers(body.companyUsers)
    : normalizeCompanyUsers(stored.companyUsers);
  stored.role = text(body.role, 30) || stored.role;
  stored.updatedAt = new Date().toISOString();

  await writeStore("users", users);
  sendJson(res, 200, { ok: true, user: serializeUser(stored) });
}

async function handleCreateOrder(req, res) {
  const body = await readJson(req);
  const pointA = text(body.pointA, 160);
  const pointB = text(body.pointB, 160);
  const cargo = text(body.cargo, 180);

  if (!pointA || !pointB || !cargo) {
    sendError(res, 422, "Укажите точку А, точку Б и груз.");
    return;
  }

  const [orders, currentUser] = await Promise.all([
    readStore("orders"),
    getCurrentUser(req)
  ]);
  const order = {
    id: nextNumberedId(orders, "GV"),
    route: `${pointA} - ${pointB}`,
    cargo: [cargo, body.weight ? `${Number(body.weight)} кг` : ""].filter(Boolean).join(", "),
    vehicle: mapVehicle(body.vehicle),
    price: moneyEstimate(body),
    status: "draft",
    date: text(body.date, 20) || new Date().toISOString().slice(0, 10),
    pointA,
    pointB,
    weight: Number(body.weight) || null,
    volume: Number(body.volume) || null,
    comment: text(body.comment, 600),
    user: currentUser ? {
      name: currentUser.name || "Клиент",
      company: currentUser.company || "",
      verified: Boolean(currentUser.verified && currentUser.companyVerified)
    } : undefined,
    createdAt: new Date().toISOString()
  };

  orders.unshift(order);
  await writeStore("orders", orders);
  sendJson(res, 201, { ok: true, order });
}

async function handleCreateDocument(req, res) {
  const body = await readJson(req);
  const documents = await readStore("documents");
  const items = Array.isArray(body.documents) ? body.documents : [body];
  const start = documents.reduce((max, item) => {
    const match = String(item.id || "").match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
  const created = items
    .filter((item) => text(item.name, 220))
    .map((item, index) => ({
      id: `DOC-${String(start + index + 1).padStart(4, "0")}`,
      name: text(item.name, 220),
      type: text(item.type, 40) || inferDocumentType(item.name),
      owner: text(item.owner, 160) || "Загружено пользователем",
      date: new Date().toLocaleDateString("ru-RU"),
      createdAt: new Date().toISOString()
    }));

  if (!created.length) {
    sendError(res, 422, "Передайте хотя бы одно имя документа.");
    return;
  }

  documents.unshift(...created);
  await writeStore("documents", documents);
  sendJson(res, 201, { ok: true, documents: created });
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "freight-backend", time: new Date().toISOString() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/orders") {
      sendJson(res, 200, { ok: true, orders: await readStore("orders") });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      await handleCreateOrder(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/carriers") {
      sendJson(res, 200, { ok: true, carriers: await readStore("carriers") });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/documents") {
      sendJson(res, 200, { ok: true, documents: await readStore("documents") });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/documents") {
      await handleCreateDocument(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/request-code") {
      await handleAuthRequest(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/verify") {
      await handleAuthVerify(req, res);
      return;
    }

    if ((req.method === "GET" || req.method === "PATCH") && url.pathname === "/api/profile") {
      await handleProfile(req, res);
      return;
    }

    sendError(res, 404, "API endpoint not found");
  } catch (error) {
    sendError(res, error.status || 500, error.message || "Internal server error");
  }
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, requested));
  const blocked = [dataDir, path.join(root, ".git"), path.join(root, "logs")];

  if (!isInside(root, filePath) || blocked.some((item) => isInside(item, filePath))) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    send(res, 200, data, types[path.extname(filePath)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found");
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  })
  .listen(port, () => {
    console.log(`Freight app is running at http://localhost:${port}`);
    console.log(`API health check: http://localhost:${port}/api/health`);
  });
