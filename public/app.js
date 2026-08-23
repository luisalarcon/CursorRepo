"use strict";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const el = (id) => document.getElementById(id);
const grid = el("grid");
const monthLabel = el("month-label");
const dayTitle = el("day-title");
const dayEvents = el("day-events");
const dayEmpty = el("day-empty");
const form = el("event-form");
const statusEl = el("status");
const saveBtn = el("save-btn");
const cancelBtn = el("cancel-btn");

const state = {
  viewYear: 0,
  viewMonth: 0,
  selected: null, // YYYY-MM-DD
  monthEvents: [], // events in the visible month range
};

let statusTimer;
function flash(message, isError) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "var(--danger)" : "var(--success)";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusEl.textContent = ""), 2500);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function ymd(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayStr() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
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

async function loadMonth() {
  const first = ymd(state.viewYear, state.viewMonth, 1);
  const lastDay = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
  const last = ymd(state.viewYear, state.viewMonth, lastDay);
  state.monthEvents = await api(`/events?from=${first}&to=${last}`);
  renderCalendar();
  if (state.selected) renderDay();
}

function countByDate() {
  const map = {};
  for (const e of state.monthEvents) {
    map[e.date] = (map[e.date] || 0) + 1;
  }
  return map;
}

function renderCalendar() {
  monthLabel.textContent = `${MONTHS[state.viewMonth]} ${state.viewYear}`;
  grid.innerHTML = "";

  const counts = countByDate();
  const today = todayStr();
  const firstWeekday = new Date(state.viewYear, state.viewMonth, 1).getDay();
  const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
  const daysPrev = new Date(state.viewYear, state.viewMonth, 0).getDate();

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysPrev - i, muted: true, month: state.viewMonth - 1 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, muted: false, month: state.viewMonth });
  }
  while (cells.length % 7 !== 0) {
    cells.push({
      day: cells.length - (firstWeekday + daysInMonth) + 1,
      muted: true,
      month: state.viewMonth + 1,
    });
  }

  for (const c of cells) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";

    let dateStr = null;
    if (!c.muted) {
      dateStr = ymd(state.viewYear, state.viewMonth, c.day);
      if (dateStr === today) cell.classList.add("cell--today");
      if (dateStr === state.selected) cell.classList.add("cell--selected");
      cell.addEventListener("click", () => selectDay(dateStr));
    } else {
      cell.classList.add("cell--muted");
      cell.disabled = true;
    }

    const num = document.createElement("span");
    num.className = "cell__num";
    num.textContent = c.day;
    cell.appendChild(num);

    if (dateStr && counts[dateStr]) {
      const badge = document.createElement("span");
      badge.className = "cell__count";
      badge.textContent = `${counts[dateStr]} event${counts[dateStr] > 1 ? "s" : ""}`;
      cell.appendChild(badge);
    }

    grid.appendChild(cell);
  }
}

function eventsForSelected() {
  return state.monthEvents
    .filter((e) => e.date === state.selected)
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
}

function renderDay() {
  const [y, m, d] = state.selected.split("-").map(Number);
  const labelDate = new Date(y, m - 1, d);
  dayTitle.textContent = labelDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const events = eventsForSelected();
  dayEvents.innerHTML = "";
  dayEmpty.classList.toggle("hidden", events.length > 0);

  for (const e of events) {
    const li = document.createElement("li");
    li.className = "event";

    const time = document.createElement("span");
    time.className = "event__time";
    time.textContent = e.startTime
      ? `${e.startTime}${e.endTime ? `–${e.endTime}` : ""}`
      : "All day";

    const body = document.createElement("div");
    body.className = "event__body";
    const title = document.createElement("div");
    title.className = "event__title";
    title.textContent = e.title;
    body.appendChild(title);
    if (e.description) {
      const desc = document.createElement("div");
      desc.className = "event__desc";
      desc.textContent = e.description;
      body.appendChild(desc);
    }

    const actions = document.createElement("div");
    actions.className = "event__actions";
    const editBtn = document.createElement("button");
    editBtn.className = "link-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => beginEdit(e));
    const delBtn = document.createElement("button");
    delBtn.className = "link-btn link-btn--danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => removeEvent(e.id));
    actions.append(editBtn, delBtn);

    li.append(time, body, actions);
    dayEvents.appendChild(li);
  }
}

function selectDay(dateStr) {
  state.selected = dateStr;
  resetForm();
  renderCalendar();
  renderDay();
}

function resetForm() {
  el("event-id").value = "";
  el("f-title").value = "";
  el("f-start").value = "";
  el("f-end").value = "";
  el("f-desc").value = "";
  saveBtn.textContent = "Add event";
  cancelBtn.classList.add("hidden");
}

function beginEdit(e) {
  el("event-id").value = e.id;
  el("f-title").value = e.title;
  el("f-start").value = e.startTime || "";
  el("f-end").value = e.endTime || "";
  el("f-desc").value = e.description || "";
  saveBtn.textContent = "Save changes";
  cancelBtn.classList.remove("hidden");
  el("f-title").focus();
}

async function onSubmit(event) {
  event.preventDefault();
  if (!state.selected) {
    flash("Pick a day first", true);
    return;
  }
  const id = el("event-id").value;
  const payload = {
    title: el("f-title").value.trim(),
    date: state.selected,
    startTime: el("f-start").value || null,
    endTime: el("f-end").value || null,
    description: el("f-desc").value.trim(),
  };
  if (!payload.title) {
    flash("Title is required", true);
    return;
  }
  try {
    if (id) {
      await api(`/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      flash("Event updated");
    } else {
      await api("/events", { method: "POST", body: JSON.stringify(payload) });
      flash("Event added");
    }
    resetForm();
    await loadMonth();
  } catch (err) {
    flash(err.message, true);
  }
}

async function removeEvent(id) {
  try {
    await api(`/events/${id}`, { method: "DELETE" });
    flash("Event deleted");
    resetForm();
    await loadMonth();
  } catch (err) {
    flash(err.message, true);
  }
}

function changeMonth(delta) {
  const d = new Date(state.viewYear, state.viewMonth + delta, 1);
  state.viewYear = d.getFullYear();
  state.viewMonth = d.getMonth();
  loadMonth();
}

el("prev").addEventListener("click", () => changeMonth(-1));
el("next").addEventListener("click", () => changeMonth(1));
el("today").addEventListener("click", () => {
  const d = new Date();
  state.viewYear = d.getFullYear();
  state.viewMonth = d.getMonth();
  selectDay(todayStr());
  loadMonth();
});
form.addEventListener("submit", onSubmit);
cancelBtn.addEventListener("click", resetForm);

(function init() {
  const now = new Date();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  state.selected = todayStr();
  loadMonth();
})();
