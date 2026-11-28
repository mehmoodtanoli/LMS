// Two applied migrations were rewritten to be idempotent (so a fresh database
// can run the whole chain). Databases that applied the old text keep the old
// checksum, and `prisma migrate dev` then offers to reset the database.
// Run once per existing database: npm run db:sync-migration-checksums
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import prisma from "../src/config/prisma.js";

const EDITED = [
  "20261028000000_v1_schema_update",
  "20261101140000_add_payment_idempotency_and_audit_nullable",
];

for (const name of EDITED) {
  const sql = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url));
  const checksum = createHash("sha256").update(sql).digest("hex");
  const updated = await prisma.$executeRaw`
    UPDATE "_prisma_migrations" SET checksum = ${checksum}
    WHERE migration_name = ${name} AND checksum <> ${checksum}`;
  console.log(`${name}: ${updated ? "checksum updated" : "already in sync"}`);
}

await prisma.$disconnect();
