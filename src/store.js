"use strict";

const fs = require("fs");
const path = require("path");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Stores calendar events. Optionally persists to a JSON file so events survive
 * server restarts; when no file path is given it stays purely in memory (used
 * by tests for isolation).
 */
class EventStore {
  constructor({ filePath = null } = {}) {
    this.filePath = filePath;
    this.events = new Map();
    this.nextId = 1;
    if (this.filePath) {
      this._load();
    }
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const data = JSON.parse(raw);
      const events = Array.isArray(data.events) ? data.events : [];
      for (const event of events) {
        this.events.set(event.id, event);
      }
      this.nextId =
        typeof data.nextId === "number"
          ? data.nextId
          : events.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  _persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload = { nextId: this.nextId, events: this.list() };
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2));
  }

  _validate({ title, date, startTime, endTime }) {
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    if (!cleanTitle) {
      throw badRequest("Event title is required");
    }
    if (!date || !isRealDate(date)) {
      throw badRequest("Event date is required in YYYY-MM-DD format");
    }
    if (startTime != null && startTime !== "" && !TIME_RE.test(startTime)) {
      throw badRequest("startTime must be in HH:MM 24-hour format");
    }
    if (endTime != null && endTime !== "" && !TIME_RE.test(endTime)) {
      throw badRequest("endTime must be in HH:MM 24-hour format");
    }
    if (startTime && endTime && endTime < startTime) {
      throw badRequest("endTime cannot be earlier than startTime");
    }
    return cleanTitle;
  }

  _sort(events) {
    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const at = a.startTime || "99:99";
      const bt = b.startTime || "99:99";
      if (at !== bt) return at < bt ? -1 : 1;
      return a.id - b.id;
    });
  }

  list() {
    return this._sort(Array.from(this.events.values()));
  }

  listByDay(date) {
    if (!isRealDate(date)) {
      throw badRequest("date must be in YYYY-MM-DD format");
    }
    return this._sort(this.list().filter((e) => e.date === date));
  }

  listByRange(from, to) {
    if (!isRealDate(from) || !isRealDate(to)) {
      throw badRequest("from and to must be in YYYY-MM-DD format");
    }
    return this._sort(
      this.list().filter((e) => e.date >= from && e.date <= to)
    );
  }

  get(id) {
    return this.events.get(Number(id));
  }

  create(input = {}) {
    const cleanTitle = this._validate(input);
    const now = new Date().toISOString();
    const event = {
      id: this.nextId++,
      title: cleanTitle,
      date: input.date,
      startTime: input.startTime || null,
      endTime: input.endTime || null,
      description:
        typeof input.description === "string" ? input.description.trim() : "",
      createdAt: now,
      updatedAt: now,
    };
    this.events.set(event.id, event);
    this._persist();
    return event;
  }

  update(id, changes = {}) {
    const event = this.get(id);
    if (!event) return undefined;

    const merged = {
      title: changes.title != null ? changes.title : event.title,
      date: changes.date != null ? changes.date : event.date,
      startTime:
        changes.startTime !== undefined ? changes.startTime : event.startTime,
      endTime: changes.endTime !== undefined ? changes.endTime : event.endTime,
    };
    const cleanTitle = this._validate(merged);

    event.title = cleanTitle;
    event.date = merged.date;
    event.startTime = merged.startTime || null;
    event.endTime = merged.endTime || null;
    if (changes.description !== undefined) {
      event.description =
        typeof changes.description === "string"
          ? changes.description.trim()
          : "";
    }
    event.updatedAt = new Date().toISOString();
    this.events.set(event.id, event);
    this._persist();
    return event;
  }

  remove(id) {
    const existed = this.events.delete(Number(id));
    if (existed) this._persist();
    return existed;
  }
}

module.exports = { EventStore, isRealDate };
