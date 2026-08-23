"use strict";

const path = require("path");
const express = require("express");
const { EventStore } = require("./store");

/**
 * Build the Calendar Express app. A store can be injected (tests use an
 * in-memory one); the server passes a file-backed store for persistence.
 */
function createApp(store = new EventStore()) {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  api.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // List events. Supports ?date=YYYY-MM-DD (single day) or
  // ?from=YYYY-MM-DD&to=YYYY-MM-DD (range); otherwise returns everything.
  api.get("/events", (req, res) => {
    try {
      const { date, from, to } = req.query;
      if (date) {
        return res.json(store.listByDay(String(date)));
      }
      if (from || to) {
        if (!from || !to) {
          return res
            .status(400)
            .json({ error: "Both from and to are required for a range query" });
        }
        return res.json(store.listByRange(String(from), String(to)));
      }
      res.json(store.list());
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  api.get("/events/:id", (req, res) => {
    const event = store.get(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  });

  api.post("/events", (req, res) => {
    try {
      const event = store.create(req.body || {});
      res.status(201).json(event);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  api.patch("/events/:id", (req, res) => {
    try {
      const event = store.update(req.params.id, req.body || {});
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  api.delete("/events/:id", (req, res) => {
    const removed = store.remove(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(204).end();
  });

  app.use("/api", api);
  app.use(express.static(path.join(__dirname, "..", "public")));

  return app;
}

module.exports = { createApp };
