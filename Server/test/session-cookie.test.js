import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { setSessionCookie, readSessionCookie, SESSION_COOKIE } from "../src/utils/sessionCookie.js";

test("session cookie is httpOnly, Lax, scoped to /api and read back", () => {
  const token = jwt.sign({ userId: "u1" }, "secret", { expiresIn: "1h" });
  let set;
  setSessionCookie({ cookie: (name, value, options) => { set = { name, value, options }; } }, token);

  assert.equal(set.name, SESSION_COOKIE);
  assert.equal(set.options.httpOnly, true);
  assert.equal(set.options.sameSite, "lax");
  assert.equal(set.options.path, "/api");
  assert.ok(set.options.expires > new Date());

  const req = { headers: { cookie: `other=1; ${SESSION_COOKIE}=${encodeURIComponent(token)}; x=2` } };
  assert.equal(readSessionCookie(req), token);
  assert.equal(readSessionCookie({ headers: {} }), null);
  assert.equal(readSessionCookie({ headers: { cookie: `${SESSION_COOKIE}=%E0%A4%A` } }), null);
});
