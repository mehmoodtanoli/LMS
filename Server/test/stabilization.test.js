import test from "node:test";
import assert from "node:assert/strict";
import { recordAuditLog } from "../src/utils/audit.js";

test("audit logging uses mapped Prisma field names and nullable entity IDs", async () => {
  const calls = [];
  const db = {
    auditLog: {
      create: async (args) => {
        calls.push(args);
        return args.data;
      },
    },
  };

  await recordAuditLog({
    db,
    userId: "user-1",
    action: "LOGIN",
    entity: "User",
  });

  assert.deepEqual(calls, [
    {
      data: {
        laboratoryId: null,
        actorUserId: "user-1",
        action: "LOGIN",
        entityType: "User",
        entityId: null,
        details: undefined,
      },
    },
  ]);
});

test("audit logging surfaces persistence failures", async () => {
  const db = {
    auditLog: {
      create: async () => {
        throw new Error("audit unavailable");
      },
    },
  };

  await assert.rejects(
    recordAuditLog({
      db,
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: "payment-1",
    }),
    /audit unavailable/
  );
});
