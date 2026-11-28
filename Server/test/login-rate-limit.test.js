import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { loginRateLimiter } from "../src/middlewares/rateLimiter.middleware.js";

test("login is blocked after 5 failed attempts stored in the database", async () => {
  const original = prisma.auditLog.count;
  try {
    prisma.auditLog.count = async ({ where }) => (where.entityId === "locked@lab.test" ? 5 : 0);

    let error;
    await loginRateLimiter({ body: { email: "Locked@lab.test" }, ip: "1.1.1.1" }, {}, (e) => { error = e; });
    assert.equal(error?.statusCode, 429);

    error = "unset";
    await loginRateLimiter({ body: { email: "ok@lab.test" }, ip: "1.1.1.2" }, {}, (e) => { error = e; });
    assert.equal(error, undefined);
  } finally {
    prisma.auditLog.count = original;
  }
});
