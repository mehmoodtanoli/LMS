# Phase 03 — Backend API Foundation

## 1. Phase Overview

Phase 3 establishes the backend API foundation for the Laboratory Management System (LMS) MVP on top of the database and domain architecture completed in Phase 2.

The phase focuses on implementing the core authenticated REST API modules required for the laboratory workflow:

* Authentication
* Patient management
* Test catalog management
* Test order management
* Result management
* Report management
* Payment management

The implementation follows the existing Express.js, Prisma, and PostgreSQL architecture and preserves the laboratory-scoped multi-tenant model defined in Phase 2.

---

## 2. Implemented API Modules

### 2.1 Authentication

Authentication provides the foundation for protected API access.

The authentication implementation establishes:

* User authentication
* Authentication middleware
* Authenticated request context through `req.user`
* Role information used by protected services
* Laboratory association for laboratory-scoped users

Protected API modules use the authentication middleware before allowing access to their routes.

---

### 2.2 Patient Management

**Route prefix:**

`/api/patients`

The patient API provides the core patient management functionality required by the laboratory workflow.

Implemented operations include:

* Patient creation
* Patient listing
* Patient retrieval
* Patient updating
* Patient deletion

Patient access is scoped according to the authenticated user's laboratory where applicable.

---

### 2.3 Test Catalog

**Route prefix:**

`/api/tests`

The test catalog API manages laboratory test definitions.

Implemented operations include:

* Test definition creation
* Test definition listing
* Test definition retrieval
* Test definition updating
* Test definition deletion

Test definitions are associated with a laboratory and follow the laboratory-scoped data model established in Phase 2.

---

### 2.4 Test Orders

**Route prefix:**

`/api/test-orders`

The test order API represents a patient's requested laboratory tests.

The implementation supports:

* Test order creation
* Test order listing
* Test order retrieval
* Test order updates
* Association of orders with patients
* Association of orders with ordered test items
* Laboratory-level access control

Test orders use the status model defined in the database domain architecture.

---

### 2.5 Result Management

**Route prefix:**

`/api/results`

The result API manages results associated with ordered test items.

The implementation supports:

* Result creation
* Result retrieval
* Result updating
* Result status handling
* Result values and related result information

Results are associated with individual ordered test items according to the Phase 2 domain model.

---

### 2.6 Report Management

**Route prefix:**

`/api/reports`

The report API provides report records generated from laboratory test orders.

Implemented operations include:

* Report creation
* Report listing
* Report retrieval by ID

Reports support:

* Report status
* Optional report title
* Snapshot data
* Report versioning
* Previous-report relationships for report history/amendments
* Laboratory-level access control
* Pagination for report listing

Report snapshots preserve the relevant order, laboratory, patient, ordered test item, and result information available when the report is created.

PDF generation and printing are not implemented as part of this phase.

---

### 2.7 Payment Management

**Route prefix:**

`/api/payments`

The payment API provides basic payment record management for test orders.

Implemented operations include:

* Payment creation
* Payment listing
* Payment retrieval by ID

Payment records support:

* Payment status
* Amount
* Payment date (`paidAt`)
* Notes
* Laboratory association
* Test order association
* Laboratory-level access control
* Pagination for payment listing

The database model permits multiple payment records to be associated with a test order.

External payment gateways, online payment processing, and advanced billing functionality are outside the scope of this phase.

---

## 3. Authorization Model

The LMS currently defines two application roles:

* `SUPERADMIN`
* `LAB_ADMIN`

### SUPERADMIN

A `SUPERADMIN` is not restricted to a single laboratory and can access laboratory-scoped resources across the system where the relevant service permits it.

### LAB_ADMIN

A `LAB_ADMIN` must be associated with a laboratory.

Laboratory-scoped resources are restricted to the user's assigned laboratory.

The API services explicitly enforce laboratory scope for the relevant operations rather than relying only on client-provided laboratory identifiers.

The implementation does not introduce separate receptionist, technician, or other staff roles at this stage, matching the small-laboratory workflow defined during Phase 2.

---

## 4. API Conventions

The backend uses common API utilities and patterns established during the earlier implementation work.

### ApiResponse

Successful API responses use the project's `ApiResponse` utility to provide a consistent response structure.

### ApiError

Expected application errors are represented through the project's `ApiError` utility and are handled by the centralized error middleware.

### asyncHandler

Asynchronous route handlers use `asyncHandler` to forward rejected promises to the centralized error handling system.

### Authentication Middleware

Protected API routes use the authentication middleware to validate the authentication token and establish the authenticated user context.

### Validation and Normalization

Service-layer implementations perform input normalization and validation where appropriate, including:

* UUID validation
* Required-field validation
* String normalization
* Enum/status validation
* Date validation
* Numeric/pagination validation

### Pagination

List endpoints that implement pagination use page and limit parameters with bounded limits.

The report and payment list APIs currently use:

* Default page: `1`
* Default limit: `20`
* Maximum limit: `100`

### Structured Errors

The API returns structured JSON error responses containing fields such as:

* `success`
* `statusCode`
* `message`
* `data`

---

## 5. Report Management Details

The `Report` domain model contains:

* Laboratory association
* Test order association
* Report status
* Optional title
* JSON snapshot
* Version number
* Previous report relationship
* Creation and update timestamps

Report creation determines the next version based on the latest report associated with the order.

When a new report is created, the previous report can be retained through the `previousReportId` relationship, allowing report history/amendment chains.

The report snapshot captures the relevant order information and associated laboratory, patient, ordered test items, and results at report creation time.

The implemented report statuses are:

* `DRAFT`
* `FINAL`
* `AMENDED`

The current Phase 3 implementation provides report records and report data retrieval. PDF generation, printing, and dedicated report rendering are not part of this implementation checkpoint.

---

## 6. Payment Management Details

The `Payment` domain model contains:

* Laboratory association
* Test order association
* Payment status
* Decimal amount
* Optional `paidAt`
* Optional notes
* Creation and update timestamps

The implemented payment statuses are:

* `UNPAID`
* `PARTIALLY_PAID`
* `PAID`
* `REFUNDED`

Payment creation requires:

* A valid test order ID
* An amount

The service verifies that the referenced test order is accessible to the authenticated user before creating the payment.

Payment listing and retrieval also enforce laboratory scope for `LAB_ADMIN` users.

Payment calculations, invoice generation, external payment gateways, and advanced billing workflows are outside the scope of this phase.

---

## 7. Runtime Verification

The following verification checks were performed during Phase 3 completion:

### Prisma Schema Validation

The Prisma schema was validated successfully using:

`npm run prisma:validate`

Result:

`The schema at prisma\schema.prisma is valid`

### Prisma Client Generation

Prisma Client was generated successfully using:

`npm run prisma:generate`

The project generated Prisma Client version `6.14.0` successfully.

### Development Server Startup

The development server was started successfully using:

`npm run dev`

The server reported successful startup on port `5000` in the development environment.

### Reports Authentication Smoke Test

A request was made to:

`GET /api/reports`

without an authentication token.

The API correctly returned:

* HTTP status: `401`
* Message: `Authentication token is missing.`

This confirms that the reports route is mounted and protected by authentication middleware.

### Payments Authentication Smoke Test

A request was made to:

`GET /api/payments`

without an authentication token.

The API correctly returned:

* HTTP status: `401`
* Message: `Authentication token is missing.`

This confirms that the payments route is mounted and protected by authentication middleware.

### Git Staged Diff Check

Before committing the Reports and Payments implementation, the staged changes were checked using:

`git diff --cached --check`

The check completed without reported errors.

### Verification Scope

These checks verify schema validity, Prisma client generation, server startup, route registration, and authentication protection for the newly added Reports and Payments routes.

They do not constitute comprehensive automated integration or end-to-end testing of every API operation.

---

## 8. Phase 3 Completion Status

Phase 3 backend implementation is **complete**.

The core backend API modules required for the current LMS MVP foundation have been implemented on top of the Phase 2 database/domain architecture.

Completed API areas:

* Authentication
* Patient management
* Test catalog
* Test orders
* Results
* Reports
* Payments

The implementation has also been verified at the schema, client-generation, server-startup, route-registration, and authentication smoke-test levels described above.

Comprehensive automated endpoint testing, PDF/print report generation, advanced billing, inventory management, and other future application functionality remain outside this Phase 3 implementation checkpoint.

---

## 9. Git Checkpoint

The Reports and Payments implementation was committed as:

`c4e2683 feat: implement reports and payments API`

This commit contains:

* `Server/src/app.js`
* `Server/src/controllers/payment.controller.js`
* `Server/src/controllers/report.controller.js`
* `Server/src/routes/payment.route.js`
* `Server/src/routes/report.route.js`
* `Server/src/services/payment.service.js`
* `Server/src/services/report.service.js`

The working tree was clean after the commit.

---

## 10. Out of Scope / Future Work

The following functionality is not part of the completed Phase 3 backend implementation:

* PDF report generation
* Printable report rendering
* Advanced invoice generation
* External payment gateway integration
* Inventory management
* Importing historical laboratory registers
* Comprehensive automated API integration testing
* Production deployment configuration
* Additional application roles beyond `SUPERADMIN` and `LAB_ADMIN`

These can be addressed in later phases according to the LMS roadmap.
