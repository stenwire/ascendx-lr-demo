import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { sampleLeaveRequests } from "../src/services/demoData.js";

const app = createApp();

async function seedTeam() {
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();

  const manager = await prisma.employee.create({
    data: { name: "Dana Wale", email: "dana.wale@example.com", teamId: "support" },
  });
  const [alex, bo, casey] = await Promise.all([
    prisma.employee.create({
      data: { name: "Alex Chen", email: "alex.chen@example.com", teamId: "support", managerId: manager.id },
    }),
    prisma.employee.create({
      data: { name: "Bo Idris", email: "bo.idris@example.com", teamId: "support", managerId: manager.id },
    }),
    prisma.employee.create({
      data: { name: "Casey Nwosu", email: "casey.nwosu@example.com", teamId: "support", managerId: manager.id },
    }),
  ]);
  return { manager, alex, bo, casey };
}

describe("POST /demo/reset-leave-requests", () => {
  let team: Awaited<ReturnType<typeof seedTeam>>;

  beforeEach(async () => {
    team = await seedTeam();
  });

  it("restores the sample set for a manager", async () => {
    const res = await request(app).post("/demo/reset-leave-requests").set("x-employee-id", team.manager.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");

    const expected = sampleLeaveRequests({
      managerId: team.manager.id,
      alexId: team.alex.id,
      boId: team.bo.id,
      caseyId: team.casey.id,
    }).length;
    expect(res.body.data.count).toBe(expected);
    expect(await prisma.leaveRequest.count()).toBe(expected);
  });

  it("replaces whatever was there before", async () => {
    await prisma.leaveRequest.create({
      data: {
        employeeId: team.alex.id,
        startDate: new Date(),
        endDate: new Date(),
        reason: "Created during the demo",
        status: "pending",
      },
    });

    await request(app).post("/demo/reset-leave-requests").set("x-employee-id", team.manager.id);

    const survivors = await prisma.leaveRequest.findMany({ where: { reason: "Created during the demo" } });
    expect(survivors).toHaveLength(0);
  });

  it("leaves employees untouched, so stored identities stay valid", async () => {
    await request(app).post("/demo/reset-leave-requests").set("x-employee-id", team.manager.id);

    const employees = await prisma.employee.findMany();
    expect(employees).toHaveLength(4);
    expect(employees.map((e) => e.id)).toContain(team.alex.id);
  });

  it("refuses a non-manager", async () => {
    const res = await request(app).post("/demo/reset-leave-requests").set("x-employee-id", team.alex.id);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(res.body.code).toBe("forbidden");
    // Nothing was destroyed on the way to being refused.
    expect(await prisma.leaveRequest.count()).toBe(0);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/demo/reset-leave-requests");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("unauthenticated");
  });

  it("reports a missing team rather than failing opaquely", async () => {
    // A manager exists, but the named sample employees do not.
    await prisma.leaveRequest.deleteMany();
    await prisma.employee.deleteMany();
    const lone = await prisma.employee.create({
      data: { name: "Solo Manager", email: "solo@example.com", teamId: "support" },
    });
    await prisma.employee.create({
      data: { name: "Someone Else", email: "else@example.com", teamId: "support", managerId: lone.id },
    });

    const res = await request(app).post("/demo/reset-leave-requests").set("x-employee-id", lone.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("demo_team_missing");
  });
});
