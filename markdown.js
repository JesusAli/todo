function tasksToMarkdown(tasks) {
  const lines = [
    "# Actividades",
    "",
    "> Base de datos en Markdown. Cada bloque es una actividad.",
    "",
  ];

  tasks.forEach((task) => {
    lines.push(`### ${task.id}`);
    lines.push(`- status: ${task.status}`);
    lines.push(`- tag: ${task.tag}`);
    lines.push(`- due: ${task.dueDate || ""}`);
    lines.push(`- created: ${task.createdAt}`);
    lines.push(`- title: ${escapeMarkdownValue(task.title)}`);
    lines.push("");
  });

  return lines.join("\n");
}

function markdownToTasks(markdown) {
  if (!markdown || !markdown.trim()) return [];

  const blocks = markdown.split(/^### /m).slice(1);
  return blocks
    .map((block) => {
      const [firstLine, ...rest] = block.split("\n");
      const id = firstLine.trim();
      const fields = {};
      rest.forEach((line) => {
        const match = line.match(/^- ([a-z]+):\s?(.*)$/);
        if (match) fields[match[1]] = match[2];
      });
      if (!id || !fields.title) return null;
      return {
        id,
        title: unescapeMarkdownValue(fields.title),
        status: ["todo", "doing", "done"].includes(fields.status) ? fields.status : "todo",
        tag: fields.tag === "trabajo" ? "trabajo" : "personal",
        dueDate: fields.due || "",
        createdAt: fields.created || new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function escapeMarkdownValue(value) {
  return String(value).replace(/\r?\n/g, " ").trim();
}

function unescapeMarkdownValue(value) {
  return String(value ?? "").trim();
}
