import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

let app: Express;
let manager: { id: string };
let alex: { id: string };
let bo: { id: string };

beforeEach(async () => {
  app = createApp();
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();

  manager = await prisma.employee.create({ data: { name: "Test Manager", email: `mgr-${Date.now()}@example.com`, teamId: "qa" } });
  alex = await prisma.employee.create({ data: { name: "Alex Test", email: `alex-${Date.now()}@example.com`, teamId: "qa", managerId: manager.id } });
  bo = await prisma.employee.create({ data: { name: "Bo Test", email: `bo-${Date.now()}@example.com`, teamId: "qa", managerId: manager.id } });
});

afterAll(async () => {
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.$disconnect();
});

describe("POST /leave-requests", () => {
  it("requires the x-employee-id header", async () => {
    const res = await request(app).post("/leave-requests").send({ startDate: "2027-01-10", endDate: "2027-01-12", reason: "PTO" });
    expect(res.status).toBe(401);
  });

  it("creates a pending request for a valid payload", async () => {
    const res = await request(app)
      .post("/leave-requests")
      .set("x-employee-id", alex.id)
      .send({ startDate: "2027-01-10", endDate: "2027-01-12", reason: "PTO" });
    expect(res.status).toBe(201);
    expect(res.body.leaveRequest.status).toBe("pending");
    expect(res.body.leaveRequest.employeeId).toBe(alex.id);
  });

  it("rejects endDate before startDate with a field-level 400", async () => {
    const res = await request(app)
      .post("/leave-requests")
      .set("x-employee-id", alex.id)
      .send({ startDate: "2027-01-12", endDate: "2027-01-10", reason: "PTO" });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("endDate");
  });

  it("rejects a request fully in the past", async () => {
    const res = await request(app)
      .post("/leave-requests")
      .set("x-employee-id", alex.id)
      .send({ startDate: "2020-01-01", endDate: "2020-01-02", reason: "PTO" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing reason", async () => {
    const res = await request(app)
      .post("/leave-requests")
      .set("x-employee-id", alex.id)
      .send({ startDate: "2027-01-10", endDate: "2027-01-12", reason: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /leave-requests", () => {
  it("lists an employee's own requests via employee_id", async () => {
    await request(app).post("/leave-requests").set("x-employee-id", alex.id).send({ startDate: "2027-02-01", endDate: "2027-02-02", reason: "x" });
    const res = await request(app).get(`/leave-requests?employee_id=${alex.id}`).set("x-employee-id", alex.id);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(1);
  });

  it("gives a manager's pending queue via status=pending", async () => {
    await request(app).post("/leave-requests").set("x-employee-id", alex.id).send({ startDate: "2027-02-01", endDate: "2027-02-02", reason: "x" });
    await request(app).post("/leave-requests").set("x-employee-id", bo.id).send({ startDate: "2027-02-03", endDate: "2027-02-04", reason: "y" });
    const res = await request(app).get(`/leave-requests?status=pending`).set("x-employee-id", manager.id);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequests.length).toBeGreaterThanOrEqual(2);
  });

  it("requires either employee_id or status=pending", async () => {
    const res = await request(app).get(`/leave-requests`).set("x-employee-id", manager.id);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /leave-requests/:id", () => {
  async function createPending(employeeId: string) {
    const res = await request(app)
      .post("/leave-requests")
      .set("x-employee-id", employeeId)
      .send({ startDate: "2027-03-01", endDate: "2027-03-02", reason: "PTO" });
    return res.body.leaveRequest.id as string;
  }

  it("approves and fills in an AI message (mock mode)", async () => {
    const id = await createPending(alex.id);
    const res = await request(app).patch(`/leave-requests/${id}`).set("x-employee-id", manager.id).send({ status: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.decided).toBe(true);
    expect(res.body.leaveRequest.status).toBe("approved");
    expect(res.body.leaveRequest.aiMessage).toBeTruthy();
  });

  it("rejects without generating an AI message", async () => {
    const id = await createPending(alex.id);
    const res = await request(app).patch(`/leave-requests/${id}`).set("x-employee-id", manager.id).send({ status: "rejected" });
    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.status).toBe("rejected");
    expect(res.body.leaveRequest.aiMessage).toBeNull();
  });

  it("returns 403 when a non-manager tries to decide the request", async () => {
    const id = await createPending(alex.id);
    const res = await request(app).patch(`/leave-requests/${id}`).set("x-employee-id", bo.id).send({ status: "approved" });
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown request id", async () => {
    const res = await request(app)
      .patch(`/leave-requests/00000000-0000-0000-0000-000000000000`)
      .set("x-employee-id", manager.id)
      .send({ status: "approved" });
    expect(res.status).toBe(404);
  });

  it("rejects deciding an already-decided request", async () => {
    const id = await createPending(alex.id);
    await request(app).patch(`/leave-requests/${id}`).set("x-employee-id", manager.id).send({ status: "approved" });
    const res = await request(app).patch(`/leave-requests/${id}`).set("x-employee-id", manager.id).send({ status: "rejected" });
    expect(res.status).toBe(400);
  });

  it("warns instead of auto-approving when staffing would drop below the minimum, then approves on acknowledgement", async () => {
    // team qa = manager + alex + bo = 3, min required = ceil(3*0.5) = 2
    const aliceId = await createPending(alex.id);
    await request(app).patch(`/leave-requests/${aliceId}`).set("x-employee-id", manager.id).send({ status: "approved" });

    const boId = await createPending(bo.id);
    const warned = await request(app).patch(`/leave-requests/${boId}`).set("x-employee-id", manager.id).send({ status: "approved" });
    expect(warned.status).toBe(200);
    expect(warned.body.decided).toBe(false);
    expect(warned.body.staffingWarning).toBeTruthy();

    const approved = await request(app)
      .patch(`/leave-requests/${boId}`)
      .set("x-employee-id", manager.id)
      .send({ status: "approved", acknowledgeStaffingWarning: true });
    expect(approved.body.decided).toBe(true);
    expect(approved.body.leaveRequest.status).toBe("approved");
  });
});
