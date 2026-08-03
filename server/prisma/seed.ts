import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Deployed instances run this on every boot, so seeding is a no-op once the
  // team exists — otherwise a restart would delete real demo data. Set
  // SEED_FORCE=true to deliberately reset back to the starting state.
  const existing = await prisma.employee.count();
  if (existing > 0 && process.env.SEED_FORCE !== "true") {
    console.log(`Skipping seed: ${existing} employees already exist. Set SEED_FORCE=true to reset.`);
    return;
  }

  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();

  const manager = await prisma.employee.create({
    data: {
      name: "Dana Wale",
      email: "dana.wale@example.com",
      teamId: "support",
    },
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

  console.log("Seeded team 'support':");
  console.log(`  manager: ${manager.name} (${manager.id})`);
  console.log(`  reports: ${[alex, bo, casey].map((e) => `${e.name} (${e.id})`).join(", ")}`);
  console.log("\nUse these ids with the x-employee-id header when calling the API.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
