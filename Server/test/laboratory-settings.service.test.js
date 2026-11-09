import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {
  getLaboratoryProfile,
  updateLaboratoryProfile,
} from "../src/services/laboratory.service.js";

const laboratoryId = "00000000-0000-0000-0000-000000000001";
const otherLaboratoryId = "00000000-0000-0000-0000-000000000002";

function laboratory() {
  return {
    id: laboratoryId,
    name: "Updated Lab",
    address: "Main Street",
    phone: "+92 300 1234567",
    email: "owner@example.test",
    logoUrl: "https://example.test/logo.png",
    tagline: "Trusted diagnostics",
  };
}

test("LAB_ADMIN updates only the assigned laboratory profile", async () => {
  const originalUpdate = prisma.laboratory.update;
  const originalAuditCreate = prisma.auditLog.create;
  let updateArgs;
  prisma.laboratory.update = async (args) => {
    updateArgs = args;
    return laboratory();
  };
  prisma.auditLog.create = async () => ({});

  try {
    const result = await updateLaboratoryProfile({
      user: { role: "LAB_ADMIN", laboratoryId },
      data: {
        name: "Updated Lab",
        address: "Main Street",
        phone: "+92 300 1234567",
        email: "owner@example.test",
        logoUrl: "https://example.test/logo.png",
        tagline: "Trusted diagnostics",
      },
    });

    assert.equal(updateArgs.where.id, laboratoryId);
    assert.equal(updateArgs.data.name, "Updated Lab");
    assert.equal(result.email, "owner@example.test");
  } finally {
    prisma.laboratory.update = originalUpdate;
    prisma.auditLog.create = originalAuditCreate;
  }
});

test("LAB_ADMIN cannot change the laboratory ID through profile data", async () => {
  await assert.rejects(
    updateLaboratoryProfile({
      user: { role: "LAB_ADMIN", laboratoryId },
      data: { laboratoryId: otherLaboratoryId, name: "Other Lab" },
    }),
    /Unsupported laboratory profile field/
  );
});

test("LAB_TECH cannot update laboratory settings", async () => {
  await assert.rejects(
    updateLaboratoryProfile({
      user: { role: "LAB_TECH", laboratoryId },
      data: { name: "Attempted Update" },
    }),
    /Only laboratory administrators/
  );
});

test("invalid laboratory profile information is rejected", async () => {
  await assert.rejects(
    updateLaboratoryProfile({
      user: { role: "LAB_ADMIN", laboratoryId },
      data: { email: "not-an-email" },
    }),
    /valid email/
  );
  await assert.rejects(
    updateLaboratoryProfile({
      user: { role: "LAB_ADMIN", laboratoryId },
      data: { logoUrl: "file:///tmp/logo.png" },
    }),
    /HTTP or HTTPS/
  );
});

test("laboratory profile reads are scoped to the requested laboratory", async () => {
  const originalFindUniqueOrThrow = prisma.laboratory.findUniqueOrThrow;
  let findArgs;
  prisma.laboratory.findUniqueOrThrow = async (args) => {
    findArgs = args;
    return laboratory();
  };

  try {
    const result = await getLaboratoryProfile({ laboratoryId });
    assert.equal(findArgs.where.id, laboratoryId);
    assert.equal(result.id, laboratoryId);
    assert.equal(result.tagline, "Trusted diagnostics");
  } finally {
    prisma.laboratory.findUniqueOrThrow = originalFindUniqueOrThrow;
  }
});
