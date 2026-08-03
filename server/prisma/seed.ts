import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
