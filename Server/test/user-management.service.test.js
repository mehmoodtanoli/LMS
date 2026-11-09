import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  setUserStatus,
} from "../src/services/user.service.js";

const labA = "00000000-0000-0000-0000-000000000001";
const labB = "00000000-0000-0000-0000-000000000002";
const userA = "00000000-0000-0000-0000-000000000011";
const userB = "00000000-0000-0000-0000-000000000012";

const admin = { id: "00000000-0000-0000-0000-000000000010", role: "LAB_ADMIN", laboratoryId: labA };
const superadmin = { id: "00000000-0000-0000-0000-000000000020", role: "SUPERADMIN", laboratoryId: null };
const tech = { id: "00000000-0000-0000-0000-000000000030", role: "LAB_TECH", laboratoryId: labA };

function selectedUser(id = userA, laboratoryId = labA, role = "LAB_TECH") {
  return {
    id,
    email: "staff@example.test",
    role,
    laboratoryId,
    isActive: true,
    laboratory: { id: laboratoryId, name: "Lab A", isActive: true },
  };
}

test("SUPERADMIN can list users across laboratories", async () => {
  const originalTransaction = prisma.$transaction;
  const originalFindMany = prisma.user.findMany;
  const originalCount = prisma.user.count;
  prisma.user.findMany = async () => [selectedUser(userA)];
  prisma.user.count = async () => 1;
  prisma.$transaction = async (operations) => {
    if (Array.isArray(operations)) return [[selectedUser(userA)], 1];
    return operations(prisma);
  };

  try {
    const result = await listUsers({ actor: superadmin, query: { page: 1, limit: 20 } });
    assert.equal(result.users.length, 1);
    assert.deepEqual(result.meta.total, 1);
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.user.findMany = originalFindMany;
    prisma.user.count = originalCount;
  }
});

test("LAB_ADMIN lists only users in the assigned laboratory", async () => {
  const originalTransaction = prisma.$transaction;
  const originalFindMany = prisma.user.findMany;
  const originalCount = prisma.user.count;
  let listWhere;
  let countWhere;
  prisma.user.findMany = async ({ where }) => {
    listWhere = where;
    return [selectedUser()];
  };
  prisma.user.count = async ({ where }) => {
    countWhere = where;
    return 1;
  };
  prisma.$transaction = async (operations) => {
    return Promise.all(operations);
  };

  try {
    const result = await listUsers({ actor: admin, query: { page: 1, limit: 20 } });
    assert.equal(listWhere.laboratoryId, labA);
    assert.deepEqual(listWhere.id, { not: admin.id });
    assert.deepEqual(listWhere.role, { notIn: ["SUPERADMIN", "LAB_ADMIN"] });
    assert.equal(countWhere.laboratoryId, labA);
    assert.deepEqual(countWhere.id, { not: admin.id });
    assert.deepEqual(countWhere.role, { notIn: ["SUPERADMIN", "LAB_ADMIN"] });
    assert.equal(result.users[0].laboratoryId, labA);
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.user.findMany = originalFindMany;
    prisma.user.count = originalCount;
  }
});

test("LAB_ADMIN does not see their own account and count excludes it", async () => {
  const originalTransaction = prisma.$transaction;
  const originalFindMany = prisma.user.findMany;
  const originalCount = prisma.user.count;
  let listWhere;
  let countWhere;
  prisma.user.findMany = async ({ where }) => {
    listWhere = where;
    return [selectedUser(userA, labA, "LAB_TECH")];
  };
  prisma.user.count = async ({ where }) => {
    countWhere = where;
    return 1;
  };
  prisma.$transaction = (operations) => Promise.all(operations);

  try {
    const result = await listUsers({ actor: admin, query: { page: 1, limit: 20 } });
    assert.notEqual(result.users.some((user) => user.id === admin.id), true);
    assert.equal(result.meta.total, 1);
    assert.equal(listWhere.id.not, admin.id);
    assert.equal(countWhere.id.not, admin.id);
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.user.findMany = originalFindMany;
    prisma.user.count = originalCount;
  }
});

test("LAB_ADMIN can create a LAB_TECH only in their assigned laboratory", async () => {
  const originals = {
    laboratoryFindUnique: prisma.laboratory.findUnique,
    userFindUnique: prisma.user.findUnique,
    userCreate: prisma.user.create,
    auditCreate: prisma.auditLog.create,
  };
  prisma.laboratory.findUnique = async ({ where }) => ({ id: where.id });
  prisma.user.findUnique = async () => null;
  prisma.user.create = async ({ data }) => selectedUser(userA, data.laboratoryId, data.role);
  prisma.auditLog.create = async () => ({});

  try {
    const result = await createUser({
      actor: admin,
      data: {
        email: "staff@example.test",
        password: "password123",
        role: "LAB_TECH",
        laboratoryId: labB,
      },
    });
    assert.equal(result.role, "LAB_TECH");
    assert.equal(result.laboratoryId, labA);
  } finally {
    prisma.laboratory.findUnique = originals.laboratoryFindUnique;
    prisma.user.findUnique = originals.userFindUnique;
    prisma.user.create = originals.userCreate;
    prisma.auditLog.create = originals.auditCreate;
  }
});

test("LAB_ADMIN cannot access another laboratory's users", async () => {
  const originalFindFirst = prisma.user.findFirst;
  prisma.user.findFirst = async ({ where }) => {
    assert.deepEqual(where, {
      AND: [
        {
          laboratoryId: labA,
          id: { not: admin.id },
          role: { notIn: ["SUPERADMIN", "LAB_ADMIN"] },
        },
        { id: userB },
      ],
    });
    return null;
  };

  try {
    await assert.rejects(
      getUserById({ actor: admin, userId: userB }),
      /User not found/
    );
  } finally {
    prisma.user.findFirst = originalFindFirst;
  }
});

test("LAB_ADMIN cannot create privileged accounts", async () => {
  await assert.rejects(
    createUser({
      actor: admin,
      data: { email: "admin@example.test", password: "password123", role: "LAB_ADMIN" },
    }),
    /only create LAB_TECH/
  );
});

test("LAB_ADMIN cannot change a user's role or laboratory", async () => {
  const originalFindFirst = prisma.user.findFirst;
  prisma.user.findFirst = async () => ({
    id: userA,
    email: "staff@example.test",
    role: "LAB_TECH",
    laboratoryId: labA,
  });

  try {
    await assert.rejects(
      updateUser({
        actor: admin,
        userId: userA,
        data: { role: "LAB_ADMIN", laboratoryId: labB },
      }),
      /cannot change roles/
    );
  } finally {
    prisma.user.findFirst = originalFindFirst;
  }
});

test("LAB_ADMIN cannot edit or deactivate their own account", async () => {
  const originalFindFirst = prisma.user.findFirst;
  prisma.user.findFirst = async ({ where }) => {
    assert.deepEqual(where, {
      AND: [
        {
          laboratoryId: labA,
          id: { not: admin.id },
          role: { notIn: ["SUPERADMIN", "LAB_ADMIN"] },
        },
        { id: admin.id },
      ],
    });
    return null;
  };

  try {
    await assert.rejects(
      updateUser({
        actor: admin,
        userId: admin.id,
        data: { email: "new@example.test" },
      }),
      /User not found/
    );
    await assert.rejects(
      setUserStatus({ actor: admin, userId: admin.id, isActive: false }),
      /User not found/
    );
  } finally {
    prisma.user.findFirst = originalFindFirst;
  }
});

test("LAB_TECH cannot access user management", async () => {
  await assert.rejects(
    listUsers({ actor: tech, query: { page: 1, limit: 20 } }),
    /not authorized/
  );
  await assert.rejects(
    setUserStatus({ actor: tech, userId: userA, isActive: false }),
    /not authorized/
  );
});
