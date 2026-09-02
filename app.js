const COOKIE_NAME = "actividades_session";
const GIST_DESCRIPTION = "Actividades TODO — base de datos markdown";
const GIST_FILENAME = "actividades.md";
const SESSION_DAYS = 30;
const LOCAL_CACHE_KEY = "actividades-todo";

const lists = {
  todo: document.getElementById("list-todo"),
  doing: document.getElementById("list-doing"),
  done: document.getElementById("list-done"),
};

const filters = {
  search: document.getElementById("search-input"),
  tag: document.getElementById("tag-filter"),
  date: document.getElementById("date-filter"),
};

let tasks = [];
let session = null;
let saveTimer = null;
let saving = false;

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function parseLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDate(value) {
  return parseLocalDate(value).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function cookieOptions() {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; SameSite=Strict${secure}`;
}

function writeSessionCookie(data) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(encoded)}; ${cookieOptions()}`;
}

function readSessionCookie() {
  const prefix = `${COOKIE_NAME}=`;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!raw) return null;
  try {
    const encoded = decodeURIComponent(raw.slice(prefix.length));
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

function clearSessionCookie() {
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Strict`;
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `GitHub ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function findOrCreateGist(token, initialMarkdown) {
  const gists = await githubRequest("/gists?per_page=100", token);
  const existing = gists.find(
    (gist) => gist.description === GIST_DESCRIPTION && gist.files && gist.files[GIST_FILENAME],
  );
  if (existing) return existing.id;

  const created = await githubRequest("/gists", token, {
    method: "POST",
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: { content: initialMarkdown || "# Actividades\n" },
      },
    }),
  });
  return created.id;
}

async function readMarkdown(token, gistId) {
  const gist = await githubRequest(`/gists/${gistId}`, token);
  return gist.files?.[GIST_FILENAME]?.content || "# Actividades\n";
}

async function writeMarkdown(token, gistId, markdown) {
  await githubRequest(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content: markdown || "# Actividades\n" },
      },
    }),
  });
}

function setStatus(message, kind = "") {
  const el = document.getElementById("sync-status");
  el.textContent = message;
  el.dataset.kind = kind;
}

function showApp() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("app-screen").hidden = false;
  document.getElementById("session-user").textContent = session.login;
  document.getElementById("logout-button").textContent = session.local
    ? "Iniciar sesión"
    : "Cerrar sesión";
}

function showLogin(message = "") {
  document.getElementById("app-screen").hidden = true;
  document.getElementById("login-screen").hidden = false;
  document.getElementById("login-error").textContent = message;
}

function cachedTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
  } catch {
    return [];
  }
}

// Las tareas guardadas antes de las etiquetas y fechas no traen todos los campos.
function normalizeTask(task) {
  const created = new Date(task.createdAt);
  return {
    id: task.id || crypto.randomUUID(),
    title: task.title || "",
    status: ["todo", "doing", "done"].includes(task.status) ? task.status : "todo",
    tag: task.tag === "trabajo" ? "trabajo" : "personal",
    dueDate: task.dueDate || "",
    createdAt: Number.isNaN(created.getTime()) ? new Date().toISOString() : task.createdAt,
  };
}

function cacheTasks(next) {
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(next));
}

function scheduleSave(next) {
  tasks = next;
  cacheTasks(next);
  render(next);
  if (session?.local) {
    setStatus("Guardado solo en este navegador", "");
    return;
  }
  setStatus("Guardando en Markdown…", "pending");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistMarkdown(next), 400);
}

async function persistMarkdown(next) {
  if (!session || session.local) return;
  saving = true;
  try {
    await writeMarkdown(session.token, session.gistId, tasksToMarkdown(next));
    setStatus("Guardado en Markdown", "ok");
  } catch (error) {
    if (error.status === 401) {
      logout("La sesión caducó. Vuelve a entrar.");
      return;
    }
    setStatus("No se pudo guardar. Revisa la conexión.", "error");
  } finally {
    saving = false;
  }
}

function render(current) {
  const visibleTasks = filterTasks(current);

  Object.values(lists).forEach((list) => {
    list.innerHTML = "";
  });

  const grouped = { todo: [], doing: [], done: [] };
  visibleTasks.forEach((task) => {
    if (grouped[task.status]) grouped[task.status].push(task);
  });

  Object.entries(grouped).forEach(([status, items]) => {
    document.querySelector(`[data-count="${status}"]`).textContent = items.length;
    const list = lists[status];
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = visibleTasks.length ? "Nada por aquí." : "No hay resultados.";
      list.append(empty);
      return;
    }
    items
      .sort((a, b) => sortByDueDate(a, b))
      .forEach((task) => list.append(taskCard(task)));
  });

  document.getElementById("result-summary").textContent =
    `${visibleTasks.length} de ${current.length} actividades`;
}

function taskCard(task) {
  const item = document.createElement("li");
  const dueState = getDueState(task);
  item.className = `task${task.status === "done" ? " done" : ""}${
    dueState === "overdue" ? " overdue" : ""
  }`;

  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(
    metaPill(task.tag === "trabajo" ? "Trabajo" : "Personal", `tag tag-${task.tag}`),
  );
  if (task.dueDate) {
    const dueLabel =
      dueState === "overdue"
        ? `Venció ${formatDate(task.dueDate)}`
        : dueState === "today"
          ? "Vence hoy"
          : `Límite ${formatDate(task.dueDate)}`;
    meta.append(metaPill(dueLabel, `date due-${dueState}`));
  }

  const created = document.createElement("p");
  created.className = "created";
  created.textContent = `Creada ${formatDateTime(task.createdAt)}`;

  const actions = document.createElement("div");
  actions.className = "actions";

  if (task.status !== "todo") {
    actions.append(actionButton("Por hacer", () => moveTask(task.id, "todo")));
  }
  if (task.status !== "doing") {
    actions.append(actionButton("En progreso", () => moveTask(task.id, "doing")));
  }
  if (task.status !== "done") {
    actions.append(actionButton("Hecho", () => moveTask(task.id, "done")));
  }

  const remove = actionButton("Borrar", () => {
    scheduleSave(tasks.filter((entry) => entry.id !== task.id));
  });
  remove.classList.add("danger");
  actions.append(remove);

  item.append(title, meta, created, actions);
  return item;
}

function metaPill(label, className) {
  const pill = document.createElement("span");
  pill.className = className;
  pill.textContent = label;
  return pill;
}

function actionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function moveTask(id, status) {
  scheduleSave(tasks.map((task) => (task.id === id ? { ...task, status } : task)));
}

function filterTasks(current) {
  const query = filters.search.value.trim().toLocaleLowerCase("es");
  const tag = filters.tag.value;
  const date = filters.date.value;
  const today = parseLocalDate(todayISO());
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  return current.filter((task) => {
    if (query && !task.title.toLocaleLowerCase("es").includes(query)) return false;
    if (tag !== "all" && task.tag !== tag) return false;
    if (date === "all") return true;
    if (!task.dueDate || task.status === "done") return false;

    const due = parseLocalDate(task.dueDate);
    if (date === "overdue") return due < today;
    if (date === "today") return task.dueDate === todayISO();
    if (date === "week") return due >= today && due <= weekEnd;
    return true;
  });
}

function getDueState(task) {
  if (!task.dueDate || task.status === "done") return "normal";
  if (task.dueDate === todayISO()) return "today";
  return parseLocalDate(task.dueDate) < parseLocalDate(todayISO()) ? "overdue" : "normal";
}

function sortByDueDate(a, b) {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

function logout(message = "") {
  clearSessionCookie();
  session = null;
  tasks = [];
  showLogin(message);
}

async function restoreSession() {
  const stored = readSessionCookie();
  if (!stored?.token) {
    showLogin();
    return;
  }
  try {
    await startSession(stored.token, stored.gistId);
  } catch {
    logout("La sesión no es válida. Vuelve a entrar.");
  }
}

function startLocalSession() {
  session = { local: true, login: "este navegador" };
  tasks = cachedTasks();
  cacheTasks(tasks);
  showApp();
  render(tasks);
  setStatus("Guardado solo en este navegador", "");
}

async function startSession(token, knownGistId) {
  if (token.startsWith("github_pat_")) {
    const error = new Error("fine-grained token");
    error.code = "fine-grained";
    throw error;
  }
  const user = await githubRequest("/user", token);
  const seed = tasksToMarkdown(cachedTasks());
  const gistId = knownGistId || (await findOrCreateGist(token, seed));
  const markdown = await readMarkdown(token, gistId);
  const fromMarkdown = markdownToTasks(markdown);
  tasks = fromMarkdown.length ? fromMarkdown : cachedTasks();
  if (!fromMarkdown.length && tasks.length) {
    await writeMarkdown(token, gistId, tasksToMarkdown(tasks));
  }
  session = { token, gistId, login: user.login };
  writeSessionCookie(session);
  cacheTasks(tasks);
  showApp();
  render(tasks);
  setStatus("Guardado en Markdown", "ok");
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = document.getElementById("github-token").value.trim();
  const button = event.currentTarget.querySelector("button");
  const error = document.getElementById("login-error");
  error.textContent = "";
  if (!token) {
    error.textContent = "Pega un token de GitHub con permiso gist.";
    return;
  }
  button.disabled = true;
  try {
    await startSession(token);
    event.currentTarget.reset();
  } catch (err) {
    error.textContent = loginErrorMessage(err);
  } finally {
    button.disabled = false;
  }
});

function loginErrorMessage(err) {
  if (err.code === "fine-grained") {
    return "Ese token es «fine-grained» y GitHub no le permite usar Gists. Crea un token clásico con permiso gist.";
  }
  if (err.status === 401) {
    return "El token no es válido o ya caducó.";
  }
  if (err.status === 403 || err.status === 404) {
    return "El token no tiene el permiso gist. Créalo de nuevo marcando esa casilla.";
  }
  if (err.message === "Failed to fetch") {
    return "No hubo conexión con GitHub. Revisa tu red o si algo bloquea api.github.com.";
  }
  return `No se pudo iniciar sesión: ${err.message}`;
}

document.getElementById("local-button").addEventListener("click", () => {
  startLocalSession();
});

document.getElementById("logout-button").addEventListener("click", () => {
  if (saving) return;
  logout();
});

document.getElementById("add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("task-input");
  const title = input.value.trim();
  if (!title || !session) return;

  scheduleSave([
    {
      id: crypto.randomUUID(),
      title,
      status: "todo",
      tag: document.getElementById("task-tag").value,
      dueDate: document.getElementById("task-due").value,
      createdAt: new Date().toISOString(),
    },
    ...tasks,
  ]);
  event.currentTarget.reset();
  setDefaultDueDate();
  input.focus();
});

Object.values(filters).forEach((control) => {
  control.addEventListener("input", () => render(tasks));
  control.addEventListener("change", () => render(tasks));
});

function setDefaultDueDate() {
  document.getElementById("task-due").value = todayISO();
}

setDefaultDueDate();
restoreSession();
