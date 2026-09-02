const STORAGE_KEY = "actividades-todo";

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

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [
        {
          id: crypto.randomUUID(),
          title: "Primera actividad",
          status: "todo",
          tag: "personal",
          dueDate: todayISO(),
          createdAt: new Date().toISOString(),
        },
      ];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Completa los campos de tareas guardadas con la versión anterior.
    const migrationDate = new Date().toISOString();
    const needsMigration = parsed.some(
      (task) => !task.tag || task.dueDate === undefined || !task.createdAt,
    );
    const normalized = parsed.map((task) => ({
      ...task,
      tag: task.tag || "personal",
      dueDate: task.dueDate || "",
      createdAt: task.createdAt || migrationDate,
    }));
    if (needsMigration) saveTasks(normalized);
    return normalized;
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function render(tasks) {
  const visibleTasks = filterTasks(tasks);

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
      .forEach((task) => list.append(taskCard(task, tasks)));
  });

  const summary = document.getElementById("result-summary");
  summary.textContent = `${visibleTasks.length} de ${tasks.length} actividades`;
}

function taskCard(task, tasks) {
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
    actions.append(actionButton("Por hacer", () => moveTask(tasks, task.id, "todo")));
  }
  if (task.status !== "doing") {
    actions.append(actionButton("En progreso", () => moveTask(tasks, task.id, "doing")));
  }
  if (task.status !== "done") {
    actions.append(actionButton("Hecho", () => moveTask(tasks, task.id, "done")));
  }

  const remove = actionButton("Borrar", () => {
    const next = tasks.filter((entry) => entry.id !== task.id);
    saveTasks(next);
    render(next);
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

function moveTask(tasks, id, status) {
  const next = tasks.map((task) => (task.id === id ? { ...task, status } : task));
  saveTasks(next);
  render(next);
}

function filterTasks(tasks) {
  const query = filters.search.value.trim().toLocaleLowerCase("es");
  const tag = filters.tag.value;
  const date = filters.date.value;
  const today = parseLocalDate(todayISO());
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  return tasks.filter((task) => {
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
  return new Date(value).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

document.getElementById("add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("task-input");
  const title = input.value.trim();
  if (!title) return;

  const tasks = loadTasks();
  tasks.unshift({
    id: crypto.randomUUID(),
    title,
    status: "todo",
    tag: document.getElementById("task-tag").value,
    dueDate: document.getElementById("task-due").value,
    createdAt: new Date().toISOString(),
  });
  saveTasks(tasks);
  render(tasks);
  event.currentTarget.reset();
  setDefaultDueDate();
  input.focus();
});

Object.values(filters).forEach((control) => {
  control.addEventListener("input", () => render(loadTasks()));
  control.addEventListener("change", () => render(loadTasks()));
});

function setDefaultDueDate() {
  document.getElementById("task-due").value = todayISO();
}

setDefaultDueDate();
render(loadTasks());
