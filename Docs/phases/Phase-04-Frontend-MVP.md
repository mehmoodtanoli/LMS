# Phase 4 — Frontend MVP

**Project:** Laboratory Management System (LMS)  
**Phase:** 4  
**Status:** Complete

## 1. Scope

Phase 4 delivers the working MVP frontend in `Client/`. It is a React 18 single-page application built with Vite and uses the existing LMS backend API; it does not change backend rules, Prisma models, or API contracts.

The implementation is deliberately a practical laboratory workspace for the current `LAB_ADMIN` workflow. `SUPERADMIN` compatibility is present where the backend supports it, but the fuller SUPERADMIN 2.0 operational-management experience is postponed.

## 2. Frontend foundation

`Client/` contains the final frontend. Its relevant structure is:

```text
Client/
├── src/
│   ├── api/          # Axios client and resource APIs
│   ├── auth/         # authentication/session context
│   ├── components/   # protected route and shared UI helpers
│   ├── layout/       # protected application shell
│   └── pages/        # workflow screens
├── .env.example
└── package.json
```

The application uses React 18, Vite, React Router, and Axios. The API base URL comes from `VITE_API_BASE_URL`, with `http://localhost:5000/api` as the development fallback.

Routes are defined for login, dashboard, patients, orders, results, reports, and payments. All workspace routes sit behind `ProtectedRoute`; unauthenticated users are redirected to `/login`.

### Authentication and session handling

Login submits credentials to `POST /auth/login`. On success, the returned JWT is persisted as `lms_token` in browser local storage and the returned user is kept in the authentication context.

When the application loads, the authentication context calls `GET /auth/me` if a token exists, restoring a valid session. The Axios request interceptor automatically sends `Authorization: Bearer <token>`. A `401` response dispatches the application's unauthorized event, which clears the token and user state; protected routes then return the user to login. The shell's logout control performs the same local cleanup explicitly.

## 3. Application shell and access context

The protected shell provides one consistent workspace: sidebar navigation, a top bar with the signed-in email, laboratory/role context, and logout. For a `LAB_ADMIN`, the displayed context is the assigned laboratory; for a `SUPERADMIN`, it is `All laboratories`.

The intended LAB_ADMIN flow is to sign in to a lab-scoped workspace, register/find a patient, create one or more test orders, enter results, create and print a report, and record payments. Scope is enforced by the backend, not trusted to the browser. The frontend presents SUPERADMIN-only laboratory-ID fields for patient/test creation when required by the existing API, but it does not implement a full SUPERADMIN administration console.

## 4. Implemented workflow screens

### Login and dashboard

The login screen accepts email and password and displays API errors. The dashboard is a lightweight operational overview derived from existing list APIs: patients created today, pending orders, results waiting, finalized reports, and unpaid/partially paid payment records. It also provides direct workflow shortcuts. These are current-record counts, not analytics or forecasting.

### Patients

The patients screen loads and filters the current laboratory's patient records by name, CNIC, or phone. Staff can create a patient, open patient detail, edit patient details, or request deletion through the existing patient API.

The create/edit form captures the implemented patient fields: short name, optional full name, age, gender, CNIC, phone, and address. The detail view shows the patient information and assembles related orders, results, reports, and payments from the existing APIs, giving staff a concise view of that patient's workflow history.

### Test catalog and orders

The Test Orders screen loads patients, test definitions, and recent orders. It includes the implemented catalog-creation form for test code, name, and optional description. A SUPERADMIN can provide a laboratory ID; a LAB_ADMIN uses the backend-derived laboratory scope.

To create a visit, staff choose a patient, select available tests, choose an initial order status, and optionally add notes. The backend currently accepts one `testDefinitionId` per order and creates one ordered-test item per order. To preserve that contract, selecting multiple tests in the frontend issues one create-order request for each selected test. The recent-order table allows status changes using the existing order-status contract.

### Results

The Results screen combines orders and results to present ordered test items for result entry or review. A modal form creates a result for an item or updates its existing result. It supports a JSON result value, unit, reference range, interpretation, and technician notes. The two actions use the existing `COMPLETED` and `FINALIZED` result statuses; displayed statuses otherwise come from the API.

### Reports and printing

The Reports screen creates a report for an order with an optional title and the existing `DRAFT`, `FINAL`, or `AMENDED` status. The report register displays the API-provided version.

The report detail view renders the report snapshot when available, falling back to the related order data as the API response permits. It provides a professional A4-oriented print stylesheet and a `Print / Save PDF` action through the browser print dialog. Report versioning, previous-report links, and snapshots are created by the backend; the frontend does not recreate or alter that logic.

### Payments

The Payments screen records an amount against an order, with the current API payment statuses: `UNPAID`, `PARTIALLY_PAID`, `PAID`, and `REFUNDED`. It also supports an optional paid date and notes, then displays the payment register returned by the backend. It does not implement invoices, calculations, or payment gateways.

## 5. Backend integration and current constraints

The frontend calls the established `/api` resource endpoints and consumes the backend's response envelope (`data` for successful resource payloads and structured error messages for failures). It sends only the fields required by the current API and displays API validation/authorization errors to the user.

- `LAB_ADMIN` data is laboratory-scoped by backend authorization. The UI is a client of that rule, not an alternative authorization layer.
- `SUPERADMIN` compatibility exists for the current API, but the future SUPERADMIN 2.0 system is intentionally postponed.
- A backend order currently contains one test definition and one ordered-test item at creation. The frontend deliberately preserves this by creating one order per selected test.
- Report creation, snapshotting, version increments, and previous-report relationships remain backend behavior. The UI displays and prints the resulting report data.
- Result statuses (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FINALIZED`) and payment statuses use the existing API contracts. No client-side replacement status model was introduced.

## 6. UI/UX direction

The finished MVP favors a simple, professional, practical, friendly, and clean laboratory workspace: a white/light canvas, restrained professional blue, readable tables and forms, clear status badges, focused feedback, and subtle hover/focus interaction. Result entry is designed around the ordered-test context so a technician can see the patient and test while recording values. The printable report is formatted as a professional diagnostic report rather than a dashboard export.

The design intentionally avoids excessive dashboards, fake analytics, gradients, glassmorphism, excessive animation, and unnecessary complexity. The dashboard remains a small operational summary and navigation aid.

## 7. Verification

The Phase 4 documentation checkpoint performed the following repository checks:

- `npm --prefix Client run build` — passed; Vite completed the production build.
- `git diff --check` — passed.

The source confirms the implemented authentication restoration, LAB_ADMIN-oriented UI flow, and report print view. No recorded manual end-to-end run against a live backend/API was available during this documentation-only checkpoint, so this document does not claim a new manual API, authentication, LAB_ADMIN, or print test.

## 8. Known current limitations

- There is no full SUPERADMIN 2.0 operational-management interface.
- The backend creates one test per order; multi-test selection creates multiple orders to preserve that contract.
- Result values are entered as JSON, reflecting the current API data model rather than a test-specific structured result editor.
- The client renders a print-friendly report and uses the browser print dialog; it does not generate server-side PDFs.
- The dashboard is limited to simple counts from loaded API records and is not an analytics system.

These are current MVP boundaries, not regressions or frontend workarounds to be silently redesigned.
