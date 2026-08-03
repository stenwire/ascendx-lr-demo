import { LeaveStatus, type Prisma, type PrismaClient } from "@prisma/client";

/**
 * The sample leave requests behind both the initial seed and the in-app reset,
 * kept in one place so the two can never drift apart.
 */

/** Dates are relative to today so the demo always has leave in the near future. */
export function daysFromNow(days: number): Date {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export interface DemoTeam {
  managerId: string;
  alexId: string;
  boId: string;
  caseyId: string;
}

export function sampleLeaveRequests(team: DemoTeam): Prisma.LeaveRequestCreateManyInput[] {
  const decided = { decidedById: team.managerId, decidedAt: new Date() };

  return [
    // Past leave, so every employee has some history to look at.
    {
      employeeId: team.alexId,
      startDate: daysFromNow(-30),
      endDate: daysFromNow(-28),
      reason: "Medical appointment",
      status: LeaveStatus.approved,
      aiMessage: "Hi Alex, your leave has been approved. Take care and see you when you're back.",
      ...decided,
    },
    // Two approved and overlapping, so the team timeline has bars to draw…
    {
      employeeId: team.alexId,
      startDate: daysFromNow(3),
      endDate: daysFromNow(7),
      reason: "Family holiday",
      status: LeaveStatus.approved,
      aiMessage: "Hi Alex, your leave has been approved. Enjoy the time off!",
      ...decided,
    },
    {
      employeeId: team.caseyId,
      startDate: daysFromNow(4),
      endDate: daysFromNow(8),
      reason: "Wedding",
      status: LeaveStatus.approved,
      aiMessage: "Hi Casey, your leave has been approved. Have a wonderful time!",
      ...decided,
    },
    // …and this one overlaps both, so approving it trips the staffing warning
    // and a reviewer sees that flow without having to construct it.
    {
      employeeId: team.boId,
      startDate: daysFromNow(5),
      endDate: daysFromNow(6),
      reason: "Moving house",
      status: LeaveStatus.pending,
    },
    {
      employeeId: team.alexId,
      startDate: daysFromNow(20),
      endDate: daysFromNow(22),
      reason: "Conference in Lagos",
      status: LeaveStatus.pending,
    },
    {
      employeeId: team.boId,
      startDate: daysFromNow(12),
      endDate: daysFromNow(19),
      reason: "Extended trip abroad",
      status: LeaveStatus.rejected,
      ...decided,
    },
  ];
}

/** Resolves the seeded team by name, so the samples can be rebuilt from live ids. */
export async function resolveDemoTeam(prisma: PrismaClient): Promise<DemoTeam | null> {
  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  const byName = (name: string) => employees.find((e) => e.name === name);

  const manager = employees.find((e) => e.managerId === null);
  const alex = byName("Alex Chen");
  const bo = byName("Bo Idris");
  const casey = byName("Casey Nwosu");
  if (!manager || !alex || !bo || !casey) return null;

  return { managerId: manager.id, alexId: alex.id, boId: bo.id, caseyId: casey.id };
}

/**
 * Replaces every leave request with the sample set. Employees are left alone —
 * wiping them would invalidate the id each browser has stored as its identity.
 */
export async function resetDemoLeaveRequests(prisma: PrismaClient): Promise<number> {
  const team = await resolveDemoTeam(prisma);
  if (!team) throw new Error("Demo team not found. Run the seed first.");

  return prisma.$transaction(async (tx) => {
    await tx.leaveRequest.deleteMany();
    const created = await tx.leaveRequest.createMany({ data: sampleLeaveRequests(team) });
    return created.count;
  });
}
