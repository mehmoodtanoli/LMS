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

test("failures from another IP do not lock the real user out", async () => {
  const original = prisma.auditLog.count;
  try {
    // 5 failures, all from the attacker's IP.
    prisma.auditLog.count = async ({ where }) =>
      where.details ? (where.details.equals === "6.6.6.6" ? 5 : 0) : 5;

    let error;
    await loginRateLimiter({ body: { email: "admin@lab.test" }, ip: "6.6.6.6" }, {}, (e) => { error = e; });
    assert.equal(error?.statusCode, 429);

    error = "unset";
    await loginRateLimiter({ body: { email: "admin@lab.test" }, ip: "2.2.2.2" }, {}, (e) => { error = e; });
    assert.equal(error, undefined);

    // Spread over many IPs, the per-email cap still applies.
    prisma.auditLog.count = async ({ where }) => (where.details ? 0 : 50);
    await loginRateLimiter({ body: { email: "admin@lab.test" }, ip: "3.3.3.3" }, {}, (e) => { error = e; });
    assert.equal(error?.statusCode, 429);
  } finally {
    prisma.auditLog.count = original;
  }
});
