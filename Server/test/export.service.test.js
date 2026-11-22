import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import {
  exportComplete,
  exportDataset,
  listExportDatasets,
  listExportHistory,
  parseDateRange,
} from "../src/services/export.service.js";

const LAB = "00000000-0000-0000-0000-0000000000a1";
const OTHER_LAB = "00000000-0000-0000-0000-0000000000a2";
const admin = {
  id: "u1",
  role: "LAB_ADMIN",
  laboratoryId: LAB,
  laboratory: { name: "Xpert Lab" },
};
const now = new Date("2026-11-22T10:00:00Z");

const MODELS = [
  "patient",
  "testOrder",
  "orderedTestItem",
  "result",
  "payment",
  "report",
  "laboratory",
  "testDefinition",
  "testParameter",
];

function makeDeps(data = {}, { failOn = null, auditFailsOnSuccess = false } = {}) {
  const calls = [];
  const audits = [];
  const db = {};

  for (const name of MODELS) {
    db[name] = {
      count: async ({ where }) => {
        if (failOn === name) throw new Error("db down");
        calls.push({ model: name, op: "count", where });
        return (data[name] || []).length;
      },
      findMany: async (args) => {
        if (failOn === name) throw new Error("db down");
        calls.push({ model: name, op: "findMany", where: args.where, select: args.select });
        const rows = data[name] || [];
        const start = args.cursor ? rows.findIndex((r) => r.id === args.cursor.id) + 1 : 0;
        return rows.slice(start, start + args.take);
      },
    };
  }

  const audit = async (entry) => {
    if (auditFailsOnSuccess && entry.action === "DATA_EXPORT_COMPLETED") {
      throw new Error("audit down");
    }
    audits.push(entry);
  };

  return { deps: { db, audit, now }, calls, audits };
}

const rejectsWith = (status) => (error) => error.statusCode === status;

test("only LAB_ADMIN with a laboratory may export", async () => {
  const cases = [
    { ...admin, role: "SUPERADMIN", laboratoryId: null },
    { ...admin, role: "LAB_TECH" },
    { ...admin, laboratoryId: null },
    null,
  ];

  for (const user of cases) {
    const { deps, calls, audits } = makeDeps();
    await assert.rejects(exportDataset({ user, dataset: "patients" }, deps), rejectsWith(403));
    await assert.rejects(exportComplete({ user }, deps), rejectsWith(403));
    await assert.rejects(listExportHistory({ user, query: {} }, deps), rejectsWith(403));
    assert.throws(() => listExportDatasets(user), rejectsWith(403));
    assert.equal(calls.length, 0);
    assert.equal(audits.length, 0);
  }
});

test("every query is scoped to the authenticated laboratory", async () => {
  const { deps, calls } = makeDeps();
  await exportComplete({ user: admin, laboratoryId: OTHER_LAB }, deps);

  assert.ok(calls.length >= MODELS.length);
  for (const call of calls) {
    const text = JSON.stringify(call.where);
    assert.ok(text.includes(LAB), `${call.model} query must contain the laboratory id`);
    assert.ok(!text.includes(OTHER_LAB), `${call.model} query must not use a client id`);
  }
});

test("a client supplied laboratoryId is ignored for a single dataset", async () => {
  const { deps, calls } = makeDeps();
  await exportDataset({ user: admin, dataset: "patients", laboratoryId: OTHER_LAB }, deps);
  assert.equal(calls[0].where.laboratoryId, LAB);
});

test("soft-deleted patients are excluded", async () => {
  const { deps, calls } = makeDeps();
  await exportDataset({ user: admin, dataset: "patients" }, deps);
  assert.equal(calls[0].where.isDeleted, false);
});

test("date filtering uses local day boundaries and an inclusive end date", async () => {
  const { deps, calls } = makeDeps();
  await exportDataset(
    { user: admin, dataset: "payments", from: "2026-11-01", to: "2026-11-30" },
    deps
  );

  const range = calls[0].where.createdAt;
  assert.equal(range.gte.toISOString(), "2026-10-31T19:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-11-30T19:00:00.000Z");
});

test("invalid or reversed dates are rejected before any query", async () => {
  const { deps, calls, audits } = makeDeps();
  for (const [from, to] of [
    ["2026-13-01", undefined],
    ["01/11/2026", undefined],
    ["2026-11-30", "2026-11-01"],
  ]) {
    await assert.rejects(
      exportDataset({ user: admin, dataset: "payments", from, to }, deps),
      rejectsWith(400)
    );
  }
  assert.equal(calls.length, 0);
  assert.equal(audits.length, 0);
  assert.deepEqual(parseDateRange(undefined, undefined).filter, null);
});

test("configuration datasets ignore the date range", async () => {
  const { deps, calls } = makeDeps();
  await exportDataset(
    { user: admin, dataset: "test-catalogue", from: "2026-11-01", to: "2026-11-30" },
    deps
  );
  assert.equal(calls[0].where.createdAt, undefined);
  assert.equal(calls[0].where.laboratoryId, LAB);
});

test("unknown datasets and formats are rejected", async () => {
  const { deps } = makeDeps();
  await assert.rejects(
    exportDataset({ user: admin, dataset: "users" }, deps),
    rejectsWith(404)
  );
  await assert.rejects(
    exportDataset({ user: admin, dataset: "patients", format: "xlsx" }, deps),
    rejectsWith(400)
  );
});

test("patient CSV includes CNIC and neutralises formulas", async () => {
  const { deps, audits } = makeDeps({
    patient: [
      {
        id: "p1",
        name: "=cmd",
        fullName: "Khan",
        phone: "+92 300 1234567",
        age: 30,
        ageUnit: "YEARS",
        gender: "MALE",
        address: "Street 1, Abbottabad",
        cnic: "12345-1234567-1",
        createdAt: new Date("2026-11-20T00:00:00Z"),
        updatedAt: new Date("2026-11-20T00:00:00Z"),
      },
    ],
  });

  const file = await exportDataset({ user: admin, dataset: "patients" }, deps);

  assert.equal(file.fileName, "xpert-lab-patients-20261122.csv");
  assert.ok(file.body.startsWith("\uFEFFPatient ID,Name,Full Name,Phone"));
  assert.ok(file.body.includes("'=cmd"));
  assert.ok(file.body.includes("+92 300 1234567"));
  assert.ok(file.body.includes('"Street 1, Abbottabad"'));
  assert.ok(file.body.includes("12345-1234567-1"));
  assert.equal(file.rowCount, 1);

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "DATA_EXPORT_COMPLETED");
  assert.equal(audits[0].laboratoryId, LAB);
  assert.equal(audits[0].userId, "u1");
  assert.equal(audits[0].entity, "DataExport");
  assert.equal(audits[0].details.dataset, "patients");
  assert.equal(audits[0].details.format, "csv");
  assert.equal(audits[0].details.rowCount, 1);
});

test("selects never include secrets or idempotency data", async () => {
  const { deps, calls } = makeDeps();
  await exportComplete({ user: admin }, deps);
  const text = JSON.stringify(calls.map((c) => c.select));
  for (const forbidden of ["passwordHash", "idempotencyKey", "idempotencyPayload", "snapshot"]) {
    assert.ok(!text.includes(forbidden), `${forbidden} must not be selected`);
  }
});

test("complete export is a ZIP of separate CSV files", async () => {
  const { deps, audits } = makeDeps({
    patient: [
      {
        id: "p1",
        name: "Ali",
        fullName: "Ali Khan",
        phone: null,
        age: 20,
        ageUnit: "YEARS",
        gender: "MALE",
        address: null,
        cnic: null,
        createdAt: new Date("2026-11-20T00:00:00Z"),
        updatedAt: new Date("2026-11-20T00:00:00Z"),
      },
    ],
  });

  const file = await exportComplete({ user: admin }, deps);
  assert.equal(file.contentType, "application/zip");
  assert.equal(file.fileName, "xpert-lab-complete-export-20261122.zip");
  assert.ok(Buffer.isBuffer(file.body));

  const unzipped = unzipSync(new Uint8Array(file.body));
  assert.deepEqual(Object.keys(unzipped).sort(), [
    "export-summary.txt",
    "laboratory-profile.csv",
    "order-items.csv",
    "patients.csv",
    "payments.csv",
    "reports.csv",
    "results.csv",
    "test-catalogue.csv",
    "test-orders.csv",
    "test-parameters.csv",
  ]);
  assert.ok(strFromU8(unzipped["patients.csv"]).includes("Ali Khan"));
  assert.ok(strFromU8(unzipped["export-summary.txt"]).includes("patients.csv: 1 rows"));

  assert.equal(audits[0].details.dataset, "ALL");
  assert.equal(audits[0].details.format, "zip");
  assert.equal(audits[0].details.files.patients, 1);
});

test("row limit stops the export and logs a failure", async () => {
  process.env.EXPORT_MAX_ROWS = "2";
  try {
    const rows = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const { deps, audits } = makeDeps({ payment: rows });

    await assert.rejects(
      exportDataset({ user: admin, dataset: "payments" }, deps),
      (error) => error.statusCode === 422 && /Narrow the date range/.test(error.message)
    );
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "DATA_EXPORT_FAILED");
  } finally {
    delete process.env.EXPORT_MAX_ROWS;
  }
});

test("database failure returns a generic error and logs a failed export", async () => {
  const { deps, audits } = makeDeps({}, { failOn: "payment" });

  await assert.rejects(
    exportDataset({ user: admin, dataset: "payments" }, deps),
    (error) => error.statusCode === 500 && !/db down/.test(error.message)
  );
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "DATA_EXPORT_FAILED");
  assert.ok(!JSON.stringify(audits[0].details).includes("db down"));
});

test("export fails if the success audit record cannot be written", async () => {
  const { deps } = makeDeps({}, { auditFailsOnSuccess: true });
  await assert.rejects(
    exportDataset({ user: admin, dataset: "payments" }, deps),
    rejectsWith(500)
  );
});

test("export history is scoped, paginated and mapped", async () => {
  let auditArgs;
  let userArgs;
  const db = {
    auditLog: {
      count: async ({ where }) => {
        auditArgs = { where };
        return 2;
      },
      findMany: async (args) => {
        auditArgs = { ...auditArgs, ...args };
        return [
          {
            id: "a1",
            actorUserId: "u1",
            action: "DATA_EXPORT_COMPLETED",
            details: { dataset: "patients", format: "csv", rowCount: 5, from: null, to: null },
            createdAt: new Date("2026-11-22T05:00:00Z"),
          },
          {
            id: "a2",
            actorUserId: "u1",
            action: "DATA_EXPORT_FAILED",
            details: { dataset: "ALL", format: "zip", error: "Too many rows" },
            createdAt: new Date("2026-11-21T05:00:00Z"),
          },
        ];
      },
    },
    user: {
      findMany: async (args) => {
        userArgs = args;
        return [{ id: "u1", email: "admin@lab.test" }];
      },
    },
  };

  const result = await listExportHistory({ user: admin, query: { page: "1", limit: "10" } }, { db });

  assert.equal(auditArgs.where.laboratoryId, LAB);
  assert.equal(auditArgs.where.entityType, "DataExport");
  assert.deepEqual(auditArgs.where.action.in.sort(), [
    "DATA_EXPORT_COMPLETED",
    "DATA_EXPORT_FAILED",
  ]);
  assert.equal(auditArgs.take, 10);
  assert.equal(userArgs.where.laboratoryId, LAB);

  assert.equal(result.pagination.total, 2);
  assert.equal(result.items[0].status, "COMPLETED");
  assert.equal(result.items[0].actor.email, "admin@lab.test");
  assert.equal(result.items[1].status, "FAILED");
  assert.equal(result.items[1].error, "Too many rows");
});

test("dataset catalogue lists the nine datasets", () => {
  const keys = listExportDatasets(admin).map((d) => d.key);
  assert.equal(keys.length, 9);
  assert.ok(keys.includes("patients") && keys.includes("test-parameters"));
});