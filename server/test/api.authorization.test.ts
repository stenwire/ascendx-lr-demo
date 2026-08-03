import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

const app = createApp();

/**
 * Two separate teams, so "someone else's record" means a real outsider rather
 * than just a different row.
 */
async function seedTwoTeams() {
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();

  const manager = await prisma.employee.create({
    data: { name: "Dana Wale", email: "dana@example.com", teamId: "support" },
  });
  const alex = await prisma.employee.create({
    data: { name: "Alex Chen", email: "alex@example.com", teamId: "support", managerId: manager.id },
  });
  const bo = await prisma.employee.create({
    data: { name: "Bo Idris", email: "bo@example.com", teamId: "support", managerId: manager.id },
  });

  const otherManager = await prisma.employee.create({
    data: { name: "Rival Manager", email: "rival@example.com", teamId: "sales" },
  });
  const outsider = await prisma.employee.create({
    data: { name: "Sam Okafor", email: "sam@example.com", teamId: "sales", managerId: otherManager.id },
  });

  const alexRequest = await prisma.leaveRequest.create({
    data: {
      employeeId: alex.id,
      startDate: new Date("2030-01-10"),
      endDate: new Date("2030-01-12"),
      reason: "Alex private reason",
      status: "pending",
    },
  });
  const outsiderRequest = await prisma.leaveRequest.create({
    data: {
      employeeId: outsider.id,
      startDate: new Date("2030-02-10"),
      endDate: new Date("2030-02-12"),
      reason: "Outsider private reason",
      status: "pending",
    },
  });

  return { manager, alex, bo, otherManager, outsider, alexRequest, outsiderRequest };
}

describe("read authorisation", () => {
  let t: Awaited<ReturnType<typeof seedTwoTeams>>;
  beforeEach(async () => {
    t = await seedTwoTeams();
  });

  describe("GET /leave-requests/:id", () => {
    it("lets the owner read their own request", async () => {
      const res = await request(app).get(`/leave-requests/${t.alexRequest.id}`).set("x-employee-id", t.alex.id);
      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe("Alex private reason");
    });

    it("lets the manager read a direct report's request", async () => {
      const res = await request(app).get(`/leave-requests/${t.alexRequest.id}`).set("x-employee-id", t.manager.id);
      expect(res.status).toBe(200);
    });

    it("hides a peer's request", async () => {
      const res = await request(app).get(`/leave-requests/${t.alexRequest.id}`).set("x-employee-id", t.bo.id);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("Alex private reason");
    });

    it("hides another team's request from an unrelated manager", async () => {
      const res = await request(app).get(`/leave-requests/${t.outsiderRequest.id}`).set("x-employee-id", t.manager.id);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("Outsider private reason");
    });

    it("answers 404, not 403, so an id cannot confirm a record exists", async () => {
      const hidden = await request(app).get(`/leave-requests/${t.alexRequest.id}`).set("x-employee-id", t.bo.id);
      const absent = await request(app)
        .get("/leave-requests/00000000-0000-0000-0000-000000000000")
        .set("x-employee-id", t.bo.id);

      expect(hidden.status).toBe(absent.status);
      expect(hidden.body.code).toBe(absent.body.code);
    });
  });

  describe("GET /leave-requests?employee_id=", () => {
    it("allows an employee to list their own", async () => {
      const res = await request(app).get(`/leave-requests?employee_id=${t.alex.id}`).set("x-employee-id", t.alex.id);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("allows a manager to list a direct report's", async () => {
      const res = await request(app).get(`/leave-requests?employee_id=${t.alex.id}`).set("x-employee-id", t.manager.id);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("refuses a peer", async () => {
      const res = await request(app).get(`/leave-requests?employee_id=${t.alex.id}`).set("x-employee-id", t.bo.id);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("forbidden");
    });

    it("refuses an unrelated manager", async () => {
      const res = await request(app)
        .get(`/leave-requests?employee_id=${t.outsider.id}`)
        .set("x-employee-id", t.manager.id);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /leave-requests?status=pending", () => {
    it("returns only the caller's own reports, not the whole company", async () => {
      const res = await request(app).get("/leave-requests?status=pending").set("x-employee-id", t.manager.id);

      expect(res.status).toBe(200);
      const reasons = res.body.data.map((r: { reason: string }) => r.reason);
      expect(reasons).toContain("Alex private reason");
      expect(reasons).not.toContain("Outsider private reason");
    });

    it("gives a plain employee only their own", async () => {
      const res = await request(app).get("/leave-requests?status=pending").set("x-employee-id", t.bo.id);

      expect(res.status).toBe(200);
      // Bo has no pending requests and manages nobody.
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("POST /leave-requests/:id/retry-ai-message", () => {
    it("is refused for a peer's request", async () => {
      const approved = await prisma.leaveRequest.update({
        where: { id: t.alexRequest.id },
        data: { status: "approved", decidedById: t.manager.id, decidedAt: new Date() },
      });

      const res = await request(app)
        .post(`/leave-requests/${approved.id}/retry-ai-message`)
        .set("x-employee-id", t.bo.id)
        .send({});

      expect(res.status).toBe(404);
    });

    it("is refused for the employee who owns the request", async () => {
      const approved = await prisma.leaveRequest.update({
        where: { id: t.alexRequest.id },
        data: { status: "approved", decidedById: t.manager.id, decidedAt: new Date() },
      });

      const res = await request(app)
        .post(`/leave-requests/${approved.id}/retry-ai-message`)
        .set("x-employee-id", t.alex.id)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("forbidden");
    });

    it("is allowed for the employee's manager", async () => {
      const approved = await prisma.leaveRequest.update({
        where: { id: t.alexRequest.id },
        data: { status: "approved", decidedById: t.manager.id, decidedAt: new Date() },
      });

      const res = await request(app)
        .post(`/leave-requests/${approved.id}/retry-ai-message`)
        .set("x-employee-id", t.manager.id)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.aiMessage).toBeTruthy();
    });
  });
});
