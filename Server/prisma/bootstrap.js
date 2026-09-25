import prisma from "../src/config/prisma.js";
import { hashPassword } from "../src/utils/password.js";

const SUPERADMIN_EMAIL = "superadmin@lms.test";
const SUPERADMIN_PASSWORD = "Superadmin@123";

const LAB_ADMIN_EMAIL = "labadmin.a@lms.test";
const LAB_ADMIN_PASSWORD = "Labadmin@123";

async function main() {
  console.log("Bootstrapping LMS database...");

  const laboratory = await prisma.laboratory.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000001",
    },
    update: {
      name: "Lab A",
      isActive: true,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Lab A",
      isActive: true,
    },
  });

  const superadminPasswordHash = await hashPassword(SUPERADMIN_PASSWORD);

  const superadmin = await prisma.user.upsert({
    where: {
      email: SUPERADMIN_EMAIL,
    },
    update: {
      passwordHash: superadminPasswordHash,
      role: "SUPERADMIN",
      laboratoryId: null,
      isActive: true,
    },
    create: {
      email: SUPERADMIN_EMAIL,
      passwordHash: superadminPasswordHash,
      role: "SUPERADMIN",
      laboratoryId: null,
      isActive: true,
    },
  });

  const labAdminPasswordHash = await hashPassword(LAB_ADMIN_PASSWORD);

  const labAdmin = await prisma.user.upsert({
    where: {
      email: LAB_ADMIN_EMAIL,
    },
    update: {
      passwordHash: labAdminPasswordHash,
      role: "LAB_ADMIN",
      laboratoryId: laboratory.id,
      isActive: true,
    },
    create: {
      email: LAB_ADMIN_EMAIL,
      passwordHash: labAdminPasswordHash,
      role: "LAB_ADMIN",
      laboratoryId: laboratory.id,
      isActive: true,
    },
  });

  console.log("Bootstrap completed.");
  console.log({
    laboratory: {
      id: laboratory.id,
      name: laboratory.name,
    },
    superadmin: {
      id: superadmin.id,
      email: superadmin.email,
      role: superadmin.role,
    },
    labAdmin: {
      id: labAdmin.id,
      email: labAdmin.email,
      role: labAdmin.role,
      laboratoryId: labAdmin.laboratoryId,
    },
  });
}

main()
  .catch((error) => {
    console.error("Bootstrap failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });