# Phase 1 — Database Foundation Migration

**Project:** Laboratory Management System (LMS)

**Phase:** 1

**Status:** Completed

**Date:** August 16, 2026

---

## 1. Phase Objective

Establish the database foundation for the LMS by migrating the backend from MongoDB/Mongoose to PostgreSQL using Prisma.

The purpose of this phase was to prepare the backend architecture for the relational database model that will be designed in the next phase.

No LMS-specific database models were created during this phase.

---

## 2. Starting Architecture

The backend originally used:

- Node.js
- Express
- MongoDB
- Mongoose
- JWT-based authentication utilities
- dotenv environment configuration

The database connection was handled through:

`Server/Src/config/db.js`

The environment configuration required:

`MONGODB_URI`

---

## 3. Target Architecture

The backend now uses:

- Node.js
- Express
- PostgreSQL
- Prisma ORM
- Prisma Client
- JWT utilities
- dotenv environment configuration

The database connection is represented through:

`DATABASE_URL`

Prisma schema location:

`Server/prisma/schema.prisma`

Prisma client bootstrap:

`Server/src/config/prisma.js`

---

## 4. Changes Implemented

### 4.1 Removed Mongoose

The `mongoose` dependency was removed from:

`Server/package.json`

The corresponding lockfile was regenerated.

---

### 4.2 Added Prisma

The following packages were added:

- `prisma` — 6.14.0
- `@prisma/client` — 6.14.0

Both Prisma packages are intentionally pinned to the same version.

---

### 4.3 Removed MongoDB Database Bootstrap

Removed:

`Server/src/config/db.js`

The previous Mongoose connection bootstrap is no longer part of the application.

---

### 4.4 Added Prisma Client Bootstrap

Added:

`Server/src/config/prisma.js`

The file provides a reusable Prisma Client instance and avoids unnecessary Prisma Client instances during development.

---

### 4.5 Added Prisma Schema

Created:

`Server/prisma/schema.prisma`

Current schema:

- Prisma Client generator
- PostgreSQL datasource
- `DATABASE_URL`

No LMS models were added during this phase.

No Prisma migrations were created.

---

### 4.6 Updated Environment Configuration

Changed the required database environment variable from:

`MONGODB_URI`

to:

`DATABASE_URL`

The environment object now exposes:

`databaseUrl`

instead of:

`mongoUri`

Existing environment variables were preserved:

- `NODE_ENV`
- `PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

---

### 4.7 Updated Server Startup

The server startup process now imports Prisma instead of the MongoDB connection module.

Previous database initialization:

`connectDB()`

New database initialization:

`prisma.$connect()`

The existing Express startup structure was otherwise preserved.

---

### 4.8 Updated Environment Example

Updated:

`.env.example`

The database placeholder now uses PostgreSQL:

`DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE`

No real credentials were added to the repository.

---

### 4.9 Logger Cleanup

Removed obsolete MongoDB-specific sensitive-key entries from:

`Server/src/utils/logger.js`

Removed:

- `mongodburi`
- `mongouri`

No other logger behavior was changed.

---

## 5. Files Removed

The following file was removed:

`Server/src/config/db.js`

---

## 6. Files Added

The following files were added:

`Server/src/config/prisma.js`

`Server/prisma/schema.prisma`

---

## 7. Files Modified

The following files were modified:

`.env.example`

`Server/src/config/env.js`

`Server/src/server.js`

`Server/src/utils/logger.js`

`Server/package.json`

`Server/package-lock.json`

---

## 8. Database Models

No application/database models were created during Phase 1.

This was intentional.

The LMS database schema will be designed separately after the database foundation is established.

---

## 9. Prisma Migrations

No migrations were created during Phase 1.

This was intentional because the application schema has not yet been designed.

---

## 10. Verification

### Prisma Schema Validation

Command:

`npm run prisma:validate`

Result:

PASS

Prisma reported that the schema is valid.

---

### Prisma Client Generation

Command:

`npm run prisma:generate`

Result:

PASS

Prisma Client version 6.14.0 was generated successfully.

---

### Source Code MongoDB Reference Check

A source-level search was performed for:

- `mongoose`
- `MONGODB_URI`
- `mongoUri`
- `mongodburi`
- `mongouri`

Result:

No matching references remained in `Server/src`.

---

### Source Structure

The backend source directory is now:

```text
Server/src/
├── app.js
├── config/
│   ├── env.js
│   └── prisma.js
├── middlewares/
├── server.js
└── utils/