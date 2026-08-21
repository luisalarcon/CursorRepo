"use strict";

const request = require("supertest");
const { createApp } = require("../src/app");

describe("Task Board API", () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  test("health check responds ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("starts with an empty task list", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("creates a task", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "Write docs" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: "Write docs", done: false });
    expect(res.body.createdAt).toBeDefined();
  });

  test("rejects a blank title", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test("toggles a task done state", async () => {
    const created = await request(app).post("/api/tasks").send({ title: "Ship it" });
    const toggled = await request(app).patch(`/api/tasks/${created.body.id}/toggle`);
    expect(toggled.status).toBe(200);
    expect(toggled.body.done).toBe(true);
  });

  test("returns 404 when toggling a missing task", async () => {
    const res = await request(app).patch("/api/tasks/999/toggle");
    expect(res.status).toBe(404);
  });

  test("deletes a task", async () => {
    const created = await request(app).post("/api/tasks").send({ title: "Delete me" });
    const del = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get("/api/tasks");
    expect(list.body).toEqual([]);
  });

  test("returns 404 when deleting a missing task", async () => {
    const res = await request(app).delete("/api/tasks/999");
    expect(res.status).toBe(404);
  });
});
