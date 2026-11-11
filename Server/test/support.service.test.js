import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {
  stripControlCharacters,
  validateAndSanitizeSupportTicketPayload,
} from "../src/utils/sanitizers.js";
import sheetsService, { sanitizeFormulaInjection } from "../src/services/sheets.service.js";
import { createSupportTicket, getSupportConfig } from "../src/services/support.service.js";
import { supportRateLimiter, recordSupportSubmission } from "../src/middlewares/rateLimiter.middleware.js";

test("Sanitizers: stripControlCharacters removes control characters while keeping valid whitespace", () => {
  const dirty = "Hello\x00 World\x1F!\r\nLine 2\tTabbed";
  const cleaned = stripControlCharacters(dirty);
  assert.equal(cleaned, "Hello World!\r\nLine 2\tTabbed");
});

test("Sanitizers: sanitizeFormulaInjection neutralizes formula prefixes with leading apostrophe", () => {
  assert.equal(sanitizeFormulaInjection("=SUM(A1:B1)"), "'=SUM(A1:B1)");
  assert.equal(sanitizeFormulaInjection("+12345"), "'+12345");
  assert.equal(sanitizeFormulaInjection("-12345"), "'-12345");
  assert.equal(sanitizeFormulaInjection("@leak"), "'@leak");
  assert.equal(sanitizeFormulaInjection("\tformula"), "'\tformula");
  assert.equal(sanitizeFormulaInjection("%total"), "'%total");
  assert.equal(sanitizeFormulaInjection("Normal safe text"), "Normal safe text");
});

test("Sanitizers: validateAndSanitizeSupportTicketPayload validates and enforces length caps", () => {
  // Invalid category
  assert.throws(
    () =>
      validateAndSanitizeSupportTicketPayload({
        category: "INVALID_CAT",
        subject: "Valid subject",
        description: "Valid description text here",
      }),
    /Invalid category/
  );

  // Short subject (< 4 chars)
  assert.throws(
    () =>
      validateAndSanitizeSupportTicketPayload({
        category: "TECHNICAL_ISSUE",
        subject: "No",
        description: "Valid description text here",
      }),
    /Subject must be at least 4 characters long/
  );

  // Short description (< 10 chars)
  assert.throws(
    () =>
      validateAndSanitizeSupportTicketPayload({
        category: "TECHNICAL_ISSUE",
        subject: "Valid subject",
        description: "Short",
      }),
    /Description must be at least 10 characters long/
  );

  // Valid payload
  const valid = validateAndSanitizeSupportTicketPayload({
    category: "TECHNICAL_ISSUE",
    subject: "Scanner not reading barcode",
    description: "The analyzer barcode scanner timed out repeatedly on Order #55.",
    contactInfo: "+92 300 1234567",
  });

  assert.equal(valid.category, "TECHNICAL_ISSUE");
  assert.equal(valid.subject, "Scanner not reading barcode");
  assert.equal(valid.contactInfo, "+92 300 1234567");
});

test("SupportService: createSupportTicket persists ticket first, awaits webhook, handles webhook failure gracefully", async () => {
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "labtech@apex.com",
    role: "LAB_TECH",
    laboratoryId: "00000000-0000-0000-0000-000000000002",
  };

  const originalCreate = prisma.supportTicket?.create;
  const originalUpdate = prisma.supportTicket?.update;
  const originalSendWebhook = sheetsService.sendToSheetsWebhook;

  // Case 1: Webhook fails - ticket still returned with syncedToSheets: false
  sheetsService.sendToSheetsWebhook = async () => ({
    success: false,
    error: "Google Sheets service unavailable",
  });

  if (!prisma.supportTicket) {
    prisma.supportTicket = {};
  }

  prisma.supportTicket.create = async ({ data }) => {
    return {
      id: "11111111-1111-1111-1111-111111111111",
      ...data,
      createdAt: new Date(),
      laboratory: { id: user.laboratoryId, name: "Apex Pathology" },
      user: { id: user.id, email: user.email, role: user.role },
    };
  };

  prisma.supportTicket.update = async ({ data }) => {
    return {
      id: "11111111-1111-1111-1111-111111111111",
      syncedToSheets: data.syncedToSheets,
    };
  };

  const ticket = await createSupportTicket({
    user,
    payload: {
      category: "TECHNICAL_ISSUE",
      subject: "Analyzer timeout issue",
      description: "Analyzer timed out during calibration.",
    },
  });

  assert.ok(ticket.referenceCode.startsWith("SUP-"));
  assert.equal(ticket.syncedToSheets, false);
  assert.equal(ticket.subject, "Analyzer timeout issue");

  // Case 2: Webhook succeeds - ticket returned with syncedToSheets: true
  let updateCalled = false;
  sheetsService.sendToSheetsWebhook = async () => ({ success: true });
  prisma.supportTicket.update = async ({ data }) => {
    updateCalled = true;
    return { id: "11111111-1111-1111-1111-111111111111", syncedToSheets: data.syncedToSheets };
  };

  const ticket2 = await createSupportTicket({
    user,
    payload: {
      category: "GENERAL_INQUIRY",
      subject: "Billing invoice question",
      description: "Need clarification on invoice item #10.",
    },
  });

  assert.ok(ticket2.referenceCode.startsWith("SUP-"));
  assert.equal(ticket2.syncedToSheets, true);
  assert.equal(updateCalled, true);

  // Restore mocks
  prisma.supportTicket.create = originalCreate;
  prisma.supportTicket.update = originalUpdate;
  sheetsService.sendToSheetsWebhook = originalSendWebhook;
});

test("RateLimiter: supportRateLimiter blocks after 5 requests in window", async () => {
  const userId = "test-user-" + Date.now();
  const req = { user: { id: userId }, ip: "127.0.0.1" };
  const res = {};

  if (!prisma.supportTicket) {
    prisma.supportTicket = {};
  }
  const originalCount = prisma.supportTicket.count;
  prisma.supportTicket.count = async () => 0;

  // First 5 should succeed
  for (let i = 0; i < 5; i++) {
    let nextCalled = false;
    await supportRateLimiter(req, res, (err) => {
      assert.ifError(err);
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    recordSupportSubmission(userId);
  }

  // 6th should be rejected by in-memory rate limiter
  let caughtError = null;
  await supportRateLimiter(req, res, (err) => {
    caughtError = err;
  });

  assert.ok(caughtError);
  assert.equal(caughtError.statusCode, 429);

  // Test DB count check
  const freshUserId = "db-user-" + Date.now();
  const reqDb = { user: { id: freshUserId }, ip: "127.0.0.1" };
  prisma.supportTicket.count = async () => 5; // DB already has 5 tickets

  let dbCaughtError = null;
  await supportRateLimiter(reqDb, res, (err) => {
    dbCaughtError = err;
  });

  assert.ok(dbCaughtError);
  assert.equal(dbCaughtError.statusCode, 429);

  // Restore
  prisma.supportTicket.count = originalCount;
});
