"use strict";

/**
 * Tiny in-memory task store. Kept dependency-free on purpose so the development
 * environment needs no external database to run end to end.
 */
class TaskStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.tasks = new Map();
    this.nextId = 1;
  }

  list() {
    return Array.from(this.tasks.values()).sort((a, b) => a.id - b.id);
  }

  get(id) {
    return this.tasks.get(Number(id));
  }

  create(title) {
    const trimmed = typeof title === "string" ? title.trim() : "";
    if (!trimmed) {
      const error = new Error("Task title is required");
      error.statusCode = 400;
      throw error;
    }
    const task = {
      id: this.nextId++,
      title: trimmed,
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  toggle(id) {
    const task = this.get(id);
    if (!task) {
      return undefined;
    }
    task.done = !task.done;
    return task;
  }

  remove(id) {
    return this.tasks.delete(Number(id));
  }
}

module.exports = { TaskStore };
