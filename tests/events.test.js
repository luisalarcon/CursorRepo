"use strict";

const request = require("supertest");
const { createApp } = require("../src/app");
const { EventStore } = require("../src/store");

describe("Calendar events API", () => {
  let app;

  beforeEach(() => {
    app = createApp(new EventStore());
  });

  test("health check responds ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("starts empty", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("creates an event", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({ title: "Dentist", date: "2026-08-24", startTime: "09:30" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 1,
      title: "Dentist",
      date: "2026-08-24",
      startTime: "09:30",
    });
  });

  test("rejects an event without a title", async () => {
    const res = await request(app).post("/api/events").send({ date: "2026-08-24" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  test("rejects an invalid date", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({ title: "Bad", date: "2026-13-40" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date/i);
  });

  test("rejects a bad time format", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({ title: "Bad time", date: "2026-08-24", startTime: "9am" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/HH:MM/i);
  });

  test("lists events for a specific day, sorted by time", async () => {
    await request(app).post("/api/events").send({ title: "Late", date: "2026-08-24", startTime: "15:00" });
    await request(app).post("/api/events").send({ title: "Early", date: "2026-08-24", startTime: "08:00" });
    await request(app).post("/api/events").send({ title: "Other day", date: "2026-08-25" });

    const res = await request(app).get("/api/events?date=2026-08-24");
    expect(res.status).toBe(200);
    expect(res.body.map((e) => e.title)).toEqual(["Early", "Late"]);
  });

  test("lists events within a date range", async () => {
    await request(app).post("/api/events").send({ title: "In", date: "2026-08-10" });
    await request(app).post("/api/events").send({ title: "Out", date: "2026-09-10" });

    const res = await request(app).get("/api/events?from=2026-08-01&to=2026-08-31");
    expect(res.status).toBe(200);
    expect(res.body.map((e) => e.title)).toEqual(["In"]);
  });

  test("updates an event", async () => {
    const created = await request(app)
      .post("/api/events")
      .send({ title: "Meeting", date: "2026-08-24" });
    const res = await request(app)
      .patch(`/api/events/${created.body.id}`)
      .send({ title: "Team meeting", startTime: "10:00" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Team meeting");
    expect(res.body.startTime).toBe("10:00");
  });

  test("deletes an event", async () => {
    const created = await request(app)
      .post("/api/events")
      .send({ title: "Temp", date: "2026-08-24" });
    const del = await request(app).delete(`/api/events/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get("/api/events");
    expect(list.body).toEqual([]);
  });

  test("returns 404 for missing event operations", async () => {
    expect((await request(app).get("/api/events/999")).status).toBe(404);
    expect((await request(app).patch("/api/events/999").send({ title: "x" })).status).toBe(404);
    expect((await request(app).delete("/api/events/999")).status).toBe(404);
  });
});
