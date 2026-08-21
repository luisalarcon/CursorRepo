"use strict";

const path = require("path");
const express = require("express");
const { TaskStore } = require("./store");

/**
 * Build an Express app. A fresh store is created per app instance which keeps
 * tests isolated and the server stateless across restarts.
 */
function createApp(store = new TaskStore()) {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  api.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  api.get("/tasks", (_req, res) => {
    res.json(store.list());
  });

  api.post("/tasks", (req, res) => {
    try {
      const task = store.create(req.body && req.body.title);
      res.status(201).json(task);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  api.patch("/tasks/:id/toggle", (req, res) => {
    const task = store.toggle(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  });

  api.delete("/tasks/:id", (req, res) => {
    const removed = store.remove(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).end();
  });

  app.use("/api", api);
  app.use(express.static(path.join(__dirname, "..", "public")));

  return app;
}

module.exports = { createApp };
