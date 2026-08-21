"use strict";

const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const emptyEl = document.getElementById("empty");

let statusTimer;

function flashStatus(message) {
  statusEl.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
}

async function api(pathname, options) {
  const res = await fetch(`/api${pathname}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

function render(tasks) {
  list.innerHTML = "";
  const remaining = tasks.filter((t) => !t.done).length;
  countEl.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${remaining} open`;
  emptyEl.classList.toggle("hidden", tasks.length > 0);

  for (const task of tasks) {
    const li = document.createElement("li");
    li.className = `task${task.done ? " task--done" : ""}`;
    li.dataset.id = task.id;

    const toggle = document.createElement("button");
    toggle.className = "task__toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", String(task.done));
    toggle.setAttribute("aria-label", task.done ? "Mark as not done" : "Mark as done");
    toggle.addEventListener("click", () => onToggle(task.id));

    const title = document.createElement("span");
    title.className = "task__title";
    title.textContent = task.title;

    const del = document.createElement("button");
    del.className = "task__delete";
    del.type = "button";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Delete task");
    del.addEventListener("click", () => onDelete(task.id));

    li.append(toggle, title, del);
    list.appendChild(li);
  }
}

async function load() {
  try {
    render(await api("/tasks"));
  } catch (err) {
    flashStatus(err.message);
  }
}

async function onAdd(event) {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  try {
    await api("/tasks", { method: "POST", body: JSON.stringify({ title }) });
    input.value = "";
    flashStatus("Task added");
    await load();
  } catch (err) {
    flashStatus(err.message);
  }
}

async function onToggle(id) {
  try {
    await api(`/tasks/${id}/toggle`, { method: "PATCH" });
    await load();
  } catch (err) {
    flashStatus(err.message);
  }
}

async function onDelete(id) {
  try {
    await api(`/tasks/${id}`, { method: "DELETE" });
    flashStatus("Task removed");
    await load();
  } catch (err) {
    flashStatus(err.message);
  }
}

form.addEventListener("submit", onAdd);
load();
