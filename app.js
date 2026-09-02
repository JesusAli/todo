const STORAGE_KEY = "actividades-todo";

const lists = {
  todo: document.getElementById("list-todo"),
  doing: document.getElementById("list-doing"),
  done: document.getElementById("list-done"),
};

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [{ id: crypto.randomUUID(), title: "Primera actividad", status: "todo" }];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function render(tasks) {
  Object.values(lists).forEach((list) => {
    list.innerHTML = "";
  });

  const grouped = { todo: [], doing: [], done: [] };
  tasks.forEach((task) => {
    if (grouped[task.status]) grouped[task.status].push(task);
  });

  Object.entries(grouped).forEach(([status, items]) => {
    document.querySelector(`[data-count="${status}"]`).textContent = items.length;
    const list = lists[status];
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "Nada por aquí.";
      list.append(empty);
      return;
    }
    items.forEach((task) => list.append(taskCard(task, tasks)));
  });
}

function taskCard(task, tasks) {
  const item = document.createElement("li");
  item.className = `task${task.status === "done" ? " done" : ""}`;

  const title = document.createElement("p");
  title.textContent = task.title;

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

  item.append(title, actions);
  return item;
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

document.getElementById("add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("task-input");
  const title = input.value.trim();
  if (!title) return;

  const tasks = loadTasks();
  tasks.unshift({ id: crypto.randomUUID(), title, status: "todo" });
  saveTasks(tasks);
  render(tasks);
  input.value = "";
  input.focus();
});

render(loadTasks());
