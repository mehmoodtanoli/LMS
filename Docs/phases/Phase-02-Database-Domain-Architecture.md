# Phase 2 — Database Domain Architecture

**Project:** Laboratory Management System (LMS)

**Phase:** 2

**Sprint:** 2.2 — Actors & Roles

**Status:** In Progress

**Date:** 13 September 2026

---

## 1. Phase Objective

This sprint defines the initial actor and role boundaries for the LMS without introducing full authentication, authorization, or multi-tenancy implementation.

The goal is to establish the architectural decision that will guide later database modeling and access-control work while keeping the MVP intentionally simple.

No laboratory-specific domain entities were created in this sprint.

---

## 2. Actor Model

The intended role model is intentionally limited:

```text
USER
├── SUPERADMIN
└── LAB_ADMIN
```

### 2.1 USER

`USER` is the base actor concept for the system.

It represents any user identity that may eventually participate in the application.

This sprint does not define a complete `User` database model or a full application authentication flow. The model is only being clarified conceptually so future work can be aligned around a consistent user/role boundary.

### 2.2 SUPERADMIN

`SUPERADMIN` represents the platform-side administrator for the LMS.

This is not a laboratory employee role.

It exists because the platform owner must be able to support multiple laboratories, troubleshoot issues, and manage platform-wide concerns without depending on any single laboratory operator.

The `SUPERADMIN` role is therefore:

- platform-level
- not tied to a single laboratory
- able to access laboratory data for support and administration
- designed for operational oversight across the system

### 2.3 LAB_ADMIN

`LAB_ADMIN` represents the primary laboratory-side user.

This is the initial laboratory role for the MVP.

The `LAB_ADMIN` role is intended for the laboratory owner or primary administrator who manages the lab's operational data, including:

- patients
- tests
- test orders
- results
- reports
- billing and payment information
- operational settings

A small laboratory may have only one lab administrator. Some may have two. The role model is designed to support multiple users belonging to the same laboratory without over-engineering the first version.

---

## 3. Why the LMS Has a Superadmin

The LMS is a multi-laboratory platform concept, even though this sprint does not implement full multi-tenancy.

The platform owner needs a role that can:

- manage system-wide operational concerns
- support laboratories without needing labor-specific credentials
- review or assist with data across laboratories when troubleshooting issues
- maintain control over platform-level administration

This makes the `SUPERADMIN` a platform control role rather than a laboratory employee role.

---

## 4. Why Lab Admin Is the Initial Laboratory Role

For the MVP, the core laboratory user is the lab owner/admin.

This role is the closest match to how small diagnostic laboratories usually operate:

- one person often owns and manages the laboratory
- operational data is centrally managed by the lab owner/admin
- the initial system should support more than one user within a laboratory, but does not need a broad employee hierarchy yet

This keeps the first version practical and avoids introducing unnecessary authority layers that a small lab does not require.

---

## 5. Why Separate Roles Are Intentionally Excluded

The following roles are explicitly not introduced in this sprint:

- Receptionist
- Technician
- Cashier
- Doctor
- Pathologist

These roles are intentionally excluded because they would create a more complex permission model than the LMS MVP requires.

For a small laboratory, the operating model is simpler:

- the laboratory is managed by a lab administrator
- the system can eventually support multiple lab users
- role complexity should be introduced only when real laboratory needs require it

This prevents over-engineering before the actual business workflows and operational structure are fully understood.

---

## 6. Relationship to Future Multi-Tenancy

This sprint does not implement the complete multi-tenancy model.

However, the role design is being aligned with that future direction:

- laboratory operational data must eventually belong to a specific laboratory/tenant
- a `LAB_ADMIN` must only access data for their own laboratory
- a `SUPERADMIN` may access data across laboratories for platform support and administration

This sprint establishes the conceptual boundary only. It does not create the actual tenant model, laboratory ownership structure, or enforcement logic.

---

## 7. Platform-Level vs Laboratory-Level Access Boundary

The access model is intentionally simple:

### Platform-level access

`SUPERADMIN`

- operates at the platform layer
- is not restricted to one laboratory
- may assist with cross-laboratory administration and support

### Laboratory-level access

`LAB_ADMIN`

- belongs to a single laboratory
- manages that laboratory's operational data
- must not access another laboratory's data

There is no additional role matrix in this sprint.

There are no granular permissions such as:

- can view reports only
- can edit billing only
- can manage tests only

Those permissions may be introduced later if the application requires them.

---

## 8. What Is Intentionally Not Implemented in This Sprint

This sprint does not implement:

- user authentication
- JWT-based login/session flow
- password hashing
- authorization middleware
- role-based access enforcement
- `User` table creation
- `Laboratory` table creation
- tenant boundaries in the database
- permission matrix logic
- lab membership rules
- lab-scoped access checks

This is an architectural decision, not a partial feature implementation.

---

## 9. What Later Phases Will Implement

Later phases will build the required infrastructure around this architecture, including:

- complete `User` and `Laboratory` domain modeling
- role and membership relationships
- tenant-aware data boundaries
- authentication and session handling
- authorization enforcement for `SUPERADMIN` and `LAB_ADMIN`
- lab-specific access constraints
- future expansion to additional roles only if justified by real business requirements

---

## 10. Architectural Summary

The LMS should remain intentionally simple for its first version:

- `SUPERADMIN` handles platform-wide administration
- `LAB_ADMIN` handles laboratory management within a single lab
- no additional roles are introduced during this sprint
- no broad RBAC system is created yet
- multi-tenancy is acknowledged conceptually but not implemented yet

This keeps the architecture aligned with the project scope while preserving a future path toward a proper multi-laboratory platform design.

---

# Phase 2.5 — Test & Result Architecture

**Project:** Laboratory Management System (LMS)

**Phase:** 2

**Sprint:** 2.5 — Test & Result Architecture

**Status:** In Progress

**Date:** 13 September 2026

---

## 1. Phase Objective

This sprint defines the conceptual architecture for how laboratory tests and their results work before any database implementation begins.

The purpose is to keep the domain flexible enough to support different result structures while staying simple enough for a small laboratory system.

No Prisma models, schemas, migrations, or application code were created in this sprint.

---

## 2. Final Approved Workflow Model

The approved conceptual workflow is:

```text
Laboratory
  └── Patient
        └── Test Order
              └── Ordered Test Item
                    └── Test Result
                          └── Report
```

This model reflects a deliberate design choice:

- a laboratory owns the catalog of what it offers
- a patient is the subject of care
- a test order is the patient service request
- an ordered test item is the actual patient-specific instance of a test
- a test result is the outcome for that ordered test item
- a report presents finalized results in historical form

---

## 3. Test Definition Architecture

### 3.1 What a Test Definition represents

A `Test Definition` describes what the laboratory offers or performs.

It is not the patient's result.

It is the laboratory's master definition of a test category or service, such as:

- CBC
- Fasting Blood Sugar
- Lipid Profile
- Urine R/E

### 3.2 What belongs to a Test Definition

Conceptually, a `Test Definition` should capture the reusable characteristics of the test itself, such as:

- test name
- test category or group
- description
- method or interpretation context
- result structure expectations
- whether it is single-value or multi-parameter
- default unit conventions
- expected reference range context
- whether the lab offers it operationally

### 3.3 Important boundary

A `Test Definition` is not the same as:

- an order
- a patient-specific result
- a final report

It is the reusable definition for the laboratory's service catalog.

### 3.4 Why this is necessary

The same patient may have the same test multiple times, but the underlying definition of the test remains stable across those instances.

The architecture therefore needs a distinct concept for “what the lab offers” and a separate concept for “what happened for this patient at this time.”

---

## 4. Test Parameters / Result Field Definitions Architecture

### 4.1 What a parameter is

A parameter is a reusable named field that belongs to a test definition.

Examples:

- CBC → Hemoglobin
- CBC → WBC
- CBC → Platelets
- Urine R/E → Protein
- Fasting Blood Sugar → Glucose

### 4.2 Why a parameter is different from a result value

A `Parameter Definition` describes the kind of field that exists in a test.

A `Result Value` is the actual recorded value for a patient-specific result.

Conceptually:

- parameter definition = “what field exists”
- result value = “what value was recorded for this patient”

This distinction is necessary because a CBC is not a single value; it is a set of related measurements.

### 4.3 Ownership decision

The simplest architecture that matches real lab needs is:

- `Test Definition` owns the reusable parameter definitions
- `Test Result` owns the patient-specific parameter values

### 4.4 Reuse and variation

A parameter may be reused across multiple tests only if it is genuinely the same field concept.

However, the same parameter name can have different meaning or units depending on context.

For example:

- Hemoglobin is commonly a parameter in CBC, but its unit and interpretation may differ by context or test method
- a generic value name such as “Result” may exist in simple single-value tests

The key design principle is:

- keep the parameter definition reusable and test-specific
- keep the patient-specific value separate from that definition

### 4.5 Avoid over-modeling

The system should not invent an entirely separate treatment for every possible lab-specific variable. The initial model should support a generic “field/value” pattern without forcing a custom table for each test.

---

## 5. Ordered Test Item Architecture

### 5.1 Why Ordered Test Item exists

This concept exists because a laboratory does not simply record a patient and a test definition in isolation.

It must represent a specific patient-specific instance of a requested service, such as:

- the test requested during a visit
- the patient-specific instance of CBC or fasting glucose
- the time, status, billing, and result-tracking context for that single ordered test

### 5.2 What belongs to the ordered test instance

Conceptually, the `Ordered Test Item` should carry data specific to the order instance, such as:

- patient-specific ordering context
- test requested at that time
- status of the ordered test
- pricing or charge context at time of ordering
- timing or collection details
- result linkage
- ordering remarks or notes

### 5.3 Why it is separate from Test Definition

The `Test Definition` tells us what a CBC is.

The `Ordered Test Item` tells us that this specific patient had CBC ordered at a specific time, with a specific status and result lifecycle.

Without this distinction, the system cannot properly manage multiple patient encounters or repeated tests over time.

### 5.4 Relationship to Test Order

A `Test Order` may contain one or more ordered test items.

This is the cleanest conceptual way to support:

- multiple tests in a single visit
- multiple tests on a single order
- later billing or item-level tracking

---

## 6. Test Result Architecture

### 6.1 What a Test Result represents

A `Test Result` represents the actual outcome recorded for a specific ordered test item.

It is not the test definition itself, and it is not merely the final report.

It is the patient’s real result for the specific test instance.

### 6.2 Required flexibility

A result must be able to support:

- a single numeric value
- multiple numeric values
- a text value
- a categorical result such as Positive/Negative
- descriptive findings
- parameterized multi-field results such as CBC values

The model should therefore support a result as either:

- simple single-value result
- structured set of values/fields

### 6.3 Why a generic string-only result is not enough

A single generic string field would be too weak because it would lose:

- structure
- unit information
- parameter identity
- reference-range context
- interpretation/flag metadata
- future search and report formatting needs

A small lab may not need a deeply rich LIS model, but the architecture must still preserve enough structure to handle multi-parameter tests.

### 6.4 Operation concept

A result is part of a service outcome, not just a freeform note.

It must be able to express:

- a patient-specific recorded value
- the parameter/field it belongs to
- whether it is final or provisional
- whether it has been corrected or amended

---

## 7. Result Values Architecture

### 7.1 Relationship

The conceptual chain is:

```text
Test Result
  └── Result Value(s)
```

For a CBC:

```text
Test Result
├── Hemoglobin → value
├── WBC → value
├── RBC → value
├── Platelets → value
├── Hematocrit → value
└── comments/notes (optional)
```

For fasting blood sugar:

```text
Test Result
└── Glucose → value
```

For positive/negative results:

```text
Test Result
└── Result → Positive
```

For descriptive findings:

```text
Test Result
└── Finding → "Normal cellular morphology observed"
```

### 7.2 Shared generic structure

The architecture should support a generic `Result Value` pattern so that simple and complex tests can share the same conceptual model.

This means the system can represent:

- numeric values
- text values
- categorical values
- boolean or positive/negative style values
- descriptive narrative values

without requiring a separate database model for each lab test category.

### 7.3 Why this is important

The same conceptual architecture can cover all four required examples:

- a single numeric value
- a multi-parameter structured set
- positive/negative classification
- descriptive findings

A generic result-value pattern is the not-overspecific, not-underspecified middle ground.

---

## 8. Units Architecture

### 8.1 Where units belong

Units should be understood as part of the result’s interpretation context, not just as a raw string attached to a random value.

The simplest correct conceptual split is:

- `Test Definition` / `Parameter Definition` defines what kind of data is expected
- `Result Value` stores the actual measured value and its unit at the time of result recording

### 8.2 Why this is necessary

The same parameter can have different units depending on method, lab process, or test definition.

Example:

- Glucose may be recorded as mg/dL or mmol/L
- Hemoglobin may be g/dL
- WBC may be x10^3/uL or 10^9/L

### 8.3 Historical integrity requirement

If a unit changes later, historical reports must not silently reinterpret old results.

Therefore, a finalized result/report must preserve the unit that was used when that result was issued, even if the current master configuration has changed.

### 8.4 Conclusion

Units are not just metadata to be recomputed from current settings. They are part of the historical meaning of a result.

---

## 9. Reference Range Architecture

### 9.1 Why this matters

Reference ranges may vary by:

- test
- parameter
- unit
- age group
- gender
- laboratory
- method or vendor standard

### 9.2 MVP decision

The minimum useful architecture for the MVP is:

- `Test Definition` and/or `Parameter Definition` define the expected reference-range context
- `Test Result` stores the reference range used when the result was issued
- historical reports preserve that used range

### 9.3 Distinction between current and historical

There should be a conceptual split between:

- current reference configuration used by the lab today
- reference information associated with a historical result/report

This is critical because a finalized historical report must not change when today's reference range differs.

### 9.4 Why not a full demographic engine yet

The LMS should not over-engineer demographic reference systems for the MVP.

The first version should support a lab-defined, test/parameter-aware range model without creating a complex medical rules engine.

---

## 10. Result Flags / Interpretation Architecture

### 10.1 What these represent

These are labels or flags applied to a result value, such as:

- High
- Low
- Normal
- Critical
- Positive
- Negative

### 10.2 Conceptual decision

These should be treated as a result interpretation layer, not as medical diagnosis.

They may be:

- calculated by rule
- manually entered by a lab user
- stored as part of the result record

### 10.3 MVP recommendation

Keep this very simple:

- record the flag/interpretation as part of the result context
- do not build a general clinical decision system
- do not create diagnostic logic in the MVP

This is a laboratory records system, not an AI medical diagnosis engine.

---

## 11. Result Status Lifecycle

### 11.1 Core requirement

The system needs to represent how a result moves from pending to finalized output.

### 11.2 Recommended simple lifecycle

```text
PENDING
  → IN_PROGRESS
  → COMPLETED
  → VERIFIED
  → FINALIZED
```

### 11.3 MVP simplification

The system does not need a large status matrix. The core statuses are likely:

- `PENDING`
- `IN_PROGRESS`
- `COMPLETED`
- `FINALIZED`

If a future workflow requires additional verification, it can be added later without changing the core concept.

### 11.4 Why this is enough

The real workflow is:

- test is requested
- lab works on it
- result becomes available
- result is verified/finalized
- report is generated

No deeper medical approval workflow is needed in the MVP.

---

## 12. Result Correction / Amendment Strategy

### 12.1 Problem

Laboratory results may need correction after finalization.

### 12.2 Core principle

Finalized historical reports must not silently mutate.

### 12.3 MVP approach

The simplest correct concept is:

- finalized results are treated as a settled record
- corrections are represented as a new version or amendment record
- older finalized report snapshots remain historically intact

### 12.4 Why not overwrite in place

Blind overwrite of a finalized result would break historical integrity and could corrupt previously issued reports.

### 12.5 Future evolution

The system may later require richer amendment metadata, but the conceptual requirement for the MVP is simply:

- result change must be explicit
- prior version remains preserved
- report history remains unchanged

---

## 13. Report Relationship Architecture

### 13.1 How results become part of a report

A report is the final presentation layer for one or more results.

Conceptually:

```text
Test Order
  └── Ordered Test Item
        └── Test Result
              └── Report
```

### 13.2 Decision on report scope

The simplest correct MVP is:

- a report may include multiple ordered test items and results for the same patient
- one report can be generated from one or more finalized test results
- a report is a finalized snapshot generated from the selected result set

### 13.3 Why not one report per test only

In real workflows, a patient may receive a grouped report containing several related tests or a full panel result.

### 13.4 Historical integrity requirement

Reports must be finalized snapshots, not live data views.

Once a report is finalized, it should not change unless a new corrected version is explicitly created.

---

## 14. Real Example Analysis

### Example A — Simple numeric test

**Fasting Blood Sugar**

Result:

- value: 105
- unit: mg/dL
- interpretation: within range or flag based on lab reference

Conceptually:

```text
Test Definition: Fasting Blood Sugar
Ordered Test Item: patient-specific instance
Test Result: value = 105, unit = mg/dL
```

### Example B — Multi-parameter test

**CBC**

Parameters:

- Hemoglobin
- WBC
- RBC
- Platelets
- Hematocrit

Conceptually:

```text
Test Definition: CBC
Test Result
├── Hemoglobin = value
├── WBC = value
├── RBC = value
├── Platelets = value
├── Hematocrit = value
└── optional comment
```

### Example C — Positive/negative result

A test can produce a categorical value such as:

- Positive
- Negative

Conceptually:

```text
Test Result
└── Result Value = Positive
```

This can still be handled by the same generic result-value model.

### Example D — Descriptive result

A test may produce narrative findings such as:

- “Normal cellular morphology observed”
- “Mild inflammatory changes present”

Conceptually:

```text
Test Result
└── Result Value = "Normal cellular morphology observed"
```

This still fits the same fundamental result model.

### Conclusion from examples

The same result architecture can cover all four without creating a separate table per test type.

---

## 15. Historical Integrity Requirements

The following information must be preserved when a result is finalized and when a report is generated:

- result value
- unit used
- parameter name
- test definition name
- reference range used
- interpretation or flag used
- lab identity / context
- report identity or snapshot context

### What can remain current reference data

The system may continue to rely on current master configuration for operational use, but the finalized result/report must preserve the historical values that were in effect at issuance.

### Conceptual rule

Current configuration is for ongoing operations.
Historical results are for what was actually reported at the time.

---

## 16. Rejected Alternatives

### 16.1 One giant `Result` table with a single string value

**Rejected because:** it cannot represent multi-parameter tests, reference ranges, units, and structured values clearly.

### 16.2 One table per laboratory test type

**Rejected because:** it creates schema explosion and is not scalable for small-lab use.

### 16.3 Overly complex demographic reference-range engine

**Rejected because:** it is too heavy for the MVP and not required to support small local labs.

### 16.4 A diagnostic engine inside the lab record system

**Rejected because:** the LMS is a records and reporting system, not a medical decision-support engine.

### 16.5 Reporting without snapshot preservation

**Rejected because:** it violates the requirement for historical report integrity.

---

## 17. Remaining Questions

The following should be resolved later in a more detailed domain design, but they should not be overbuilt in this sprint:

1. Should parameter definitions be globally reusable or lab-specific in all cases?
2. Does every ordered test item require a separate result record, or can a single result record cover a grouped test item set?
3. Should report generation be strictly one report per order or can final patient reports include multiple orders?
4. Should correction/amendment be captured as versioning or as explicit replacement events?
5. Which result-status set is minimal but sufficient for all labs?

---

## 18. Final Position for Phase 2.5

The conceptual architecture for the MVP should be:

- `Test Definition` describes what the lab offers
- `Parameter Definition` describes the structure of a result field
- `Ordered Test Item` captures the patient-specific request instance
- `Test Result` captures the outcome for that request
- `Result Value` captures the actual data in a generic but structured manner
- units and reference ranges are tied to the result context and preserved for historical integrity
- result status and amendment strategy remain simple and explicit
- reports are finalized snapshots of selected results

This gives the project a flexible, understandable architecture without forcing premature database complexity or procedural medical sophistication.

---

# Phase 2.6 — Statuses & Enums

**Project:** Laboratory Management System (LMS)

**Phase:** 2

**Sprint:** 2.6 — Statuses & Enums

**Status:** In Progress

**Date:** 13 September 2026

---

## 1. Phase Objective

This sprint decides which domain states should exist and which should not be represented as fixed enums.

The purpose is to keep the MVP small and understandable while still preserving the minimum lifecycle semantics the lab workflow requires.

No application code, Prisma model design, database migrations, or auth implementations were created in this sprint.

---

## 2. Fundamental Principle

The system should not create an enum simply because a field has a few possible values.

Every proposed status or enum should be evaluated by:

1. Is this a true domain state or category?
2. Does the application need a fixed set of allowed values?
3. Could the values change or become lab-configurable later?
4. Should this be a fixed enum, a configuration record, or a normal field?
5. Is it required for the MVP?

This keeps the scheme from turning into enum sprawl.

---

## 3. Final Role Enum

### Decision

The fixed enum for actor roles remains:

```text
SUPERADMIN
LAB_ADMIN
```

### Why this should be an enum

- the role is intentionally closed and minimal
- the role model is deliberately limited
- the application does not need a broad role hierarchy at this stage

### Why no additional roles are included

The project specifically excludes:

- receptionist
- technician
- cashier
- doctor
- pathologist

This is deliberate and should remain fixed for the MVP.

### Why not a database record

A role matrix is not required yet; the architecture is intentionally small.

---

## 4. Test Order Status

### Decision

The recommended minimal lifecycle for a `Test Order` is:

```text
PENDING
IN_PROGRESS
COMPLETED
CANCELLED
```

### Why these values are enough

#### PENDING

A test order has been created but work has not begun.

#### IN_PROGRESS

The order is actively being processed, tested, or handled.

#### COMPLETED

The order has reached the point where testing or processing is complete, but result finalization or reporting may still be outstanding.

#### CANCELLED

The order was stopped or withdrawn.

### Why not a larger enum

The system does not need a complex order state machine for MVP small-lab operations.

### Important distinction

A `Test Order` is not the same as an `Ordered Test Item`.

An order may contain multiple items, and one item can be completed while another remains pending.

Therefore, the order-level status should be a summary or operational state, not a mistake-proof claim that all constituent items are identical.

### Payment interaction

Payment should not be the primary determinant of order status in the MVP.

An order may be complete clinically while payment is still outstanding, or payment may occur before the result is finalized.

---

## 5. Ordered Test Item Status

### Decision

The recommended lifecycle for an `Ordered Test Item` is:

```text
PENDING
IN_PROGRESS
COMPLETED
CANCELLED
FINALIZED
```

### Why this is necessary

Because one order may contain multiple tests, the item-level status must exist independently from the summary order status.

### Why it differs from order status

#### Order status

- represents the overall request or service transaction
- may aggregate multiple item states
- is not a perfect proxy for the item-level workflow

#### Ordered Test Item status

- represents the actual test being performed for a patient
- is the level at which a result will be produced
- is where finalization and reporting become meaningful

### Why omitted values were rejected

- `REPORTED` is not necessary as a separate state if `FINALIZED` already covers completion of result processing and report readiness
- a deep approval chain is not necessary for the MVP

---

## 6. Test Result Status

### Decision

The recommended minimal lifecycle for a `Test Result` is:

```text
PENDING
IN_PROGRESS
COMPLETED
FINALIZED
```

### Why `COMPLETED` and `FINALIZED` are distinct

- `COMPLETED` means the laboratory has recorded the result and the result is available
- `FINALIZED` means the result has been accepted, locked for historical integrity, and can support report generation

### Why verification is not forced into the MVP state model

Verification can be treated as a process step, not necessarily a separate fixed enum, unless a later lab workflow requires explicit sign-off.

### Amended results

If a finalized result is later corrected, the architecture should not silently overwrite it.

The conceptual approach is:

- the original final result remains preserved
- the corrected version is introduced as a new result version or amendment record
- the final report continues to reflect the historically finalized version unless a new report snapshot is produced explicitly

### Why not a larger status set

The MVP does not require a broad clinical approval chain or multi-step result governance.

---

## 7. Report Status

### Decision

The recommended minimal lifecycle for a `Report` is:

```text
DRAFT
FINAL
AMENDED
```

### Why this is enough

#### DRAFT

The report is being constructed but not yet issued.

#### FINAL

The report is finalized and should be treated as a historical snapshot.

#### AMENDED

A corrected or revised report has been generated after an earlier final version.

### Why `CANCELLED` was rejected

A report is usually a preserved historical document rather than an actively cancelled workflow record.

If a report is invalid, the correct conceptual response is a new amended version, not a deleted status.

---

## 8. Payment Status

### Decision

The recommended payment states are:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

### Why this is the minimal useful set

#### UNPAID

No payment has been received for the order or billing event.

#### PARTIALLY_PAID

Some payment has been received but not the full amount.

#### PAID

The billing obligation has been satisfied.

#### REFUNDED

A financial adjustment or refund occurred.

### Why `VOID/CANCELLED` is not the primary payment status

A cancelled payment or cancelled billing event is conceptually a transaction event, not the main payment lifecycle state.

For the MVP, the order-level balance state is more useful than a redundant cancelled flag.

### Important distinction

There are two different concepts:

- payment transaction status
- order-level payment state

These should not become redundant or contradictory.

A single payment transaction may be recorded as successful or refunded, while the overall order may still be unpaid, partially paid, or paid.

---

## 9. Payment Method Strategy

### Decision

Payment method should not be an enum unless the lab truly requires a fixed list.

For the MVP, the simplest strategy is:

- `CASH` as the primary explicit method for small labs
- treat other methods as either free text or a configurable lookup if required later

### Why not a broad enum

A wide payment-method enum can become too rigid because labs may differ in what they accept.

### Recommended approach

- for the MVP, `CASH` may be the only fixed, common method
- other methods should remain flexible until the actual lab workflow requires them

This avoids enum explosion and keeps the model realistic for small local laboratories.

---

## 10. Patient / User / Lab Status Strategy

### Decision

These should not automatically become enums in the MVP.

### Patient status

A patient record usually does not need a heavy lifecycle status unless the laboratory specifically requires active/inactive tracking.

Default recommendation:

- no separate patient status enum in the MVP
- use other operational fields if needed later

### User status

A user may simply be active/inactive as a boolean or as a simple operational record if required.

Default recommendation:

- do not add a general user status enum unless required by the actual auth/administration design

### Laboratory status

The laboratory may need active/inactive context in a future platform model, but this is not a domain requirement for the basic workflow and should be deferred.

### Why this is correct

The project has not yet implemented authentication or lab membership logic, and these states add little value before the actual operational requirements are validated.

---

## 11. Gender Strategy

### Decision

Gender should not be over-modeled in the MVP.

The simplest appropriate approach is:

- a normal text field or simple configurable lookup if the lab wants controlled values
- not a rigid demographic-heavy enum unless the lab specifically requires it

### Why not a broad enum

Small labs often need a simple and pragmatic representation, and a closed enum may become restrictive or culturally awkward.

### Recommended approach

- keep gender simple and practical for the MVP
- allow future extension if the business identifies a real need for strict standardization

---

## 12. Result Value Type Strategy

### Decision

Result value type is conceptually important, but it should not be treated as a broad fixed enum unless a real lab workflow requires it.

The likely categories are:

- numeric
- text
- categorical
- positive/negative
- descriptive

### Recommended architecture

The system should support a generic result value pattern with type-aware interpretation rather than a rigid enum-only model.

This means the result definition should allow:

- numeric values
- text values
- categorical values
- logical/boolean-like outcomes
- freeform descriptive values

without requiring a separate table or enum for every possible result style.

### Why not a strict enum to the exclusion of everything else

A real laboratory result model often needs a flexible combination of value semantics and textual notes.

---

## 13. Test / Parameter Classification Strategy

### Decision

A fixed classification enum such as:

- numeric
- panel
- text
- qualitative

should only be introduced if the laboratory truly needs it to drive behavior.

### Why not create it now

This can duplicate the purpose of the result value type concept.

The test definition should remain conceptually simple until the actual lab workflows and reporting requirements demand classification logic.

### Recommended approach

Treat test structure as descriptive metadata, not as a rigid classification system, unless the business needs it later.

---

## 14. Enum vs Database-Record Decisions

This distinction matters.

### 14.1 Fixed enum candidates

These should remain fixed enums for the MVP:

- `USER` role
- maybe a minimal test order lifecycle set
- maybe a minimal result lifecycle set
- maybe a minimal report lifecycle set

### 14.2 Configurable database record candidates

These are better modeled as database-backed configuration or master records when real requirements arise:

- payment methods
- test categories
- report templates
- lab-specific settings
- result categories

### 14.3 Normal field candidates

These are often better as plain fields rather than enums:

- gender
- freeform notes and comments
- lab-specific operational remarks
- custom user metadata

### Why this matters

The value of an enum should be limited to actual fixed state semantics, not all fields with a few allowed values.

---

## 15. Cross-Entity State Consistency

The combined workflow should remain conceptually consistent:

```text
Patient registered
  → Test Order created
    → Ordered Test Item(s)
      → testing in progress
      → result entered
      → result finalized
      → report generated/finalized
      → payment recorded
```

### Important conceptual rules

- A report should not be `FINAL` if the underlying results are not finalized.
- A finalized result should not silently change without a correction or amendment step.
- An order may be complete even if its payment is still unpaid.
- An order-level status should not falsely imply a single uniform state for every item in an order.

### Why these rules matter

They preserve operational clarity without creating a full enterprise workflow engine.

---

## 16. Rejected Alternatives

### 16.1 Large enterprise status matrix

**Rejected because:** it is overly complex for a small-laboratory MVP.

### 16.2 Separate enum for every domain concept

**Rejected because:** it causes enum explosion and makes the model harder to maintain.

### 16.3 Payment status duplicating payment transaction status and order balance state

**Rejected because:** it creates contradictory states and extra confusion.

### 16.4 Full role hierarchy and staff specialization

**Rejected because:** already excluded by the Phase 2.2 decision.

### 16.5 Demographic or clinical validation system as part of the core workflow

**Rejected because:** it is out of scope for this MVP and should not be burdening the architecture.

---

## 17. Remaining Questions

These are open questions that should be revisited only when the business workflow becomes clearer:

1. Should payment methods remain mostly freeform or become a configurable lab table?
2. Should user and lab statuses be introduced when the actual platform flow is designed?
3. Should gender remain a simple string or become a lab-configured lookup?
4. Does the lab want report finalization and result finalization to be separate conceptual steps?
5. Should result-value type be explicit at the schema level or inferred from the value payload?

---

## 18. Final Position for Phase 2.6

For the MVP, the architecture should keep only the states that are genuinely needed for the small-lab workflow:

- fixed role enum: `SUPERADMIN`, `LAB_ADMIN`
- minimal order lifecycle: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- item-level lifecycle: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `FINALIZED`
- result lifecycle: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FINALIZED`
- report lifecycle: `DRAFT`, `FINAL`, `AMENDED`
- payment lifecycle: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`
- simple flexible handling for gender, value type, and method information rather than broad enums

This is the minimum practical state design for a small-laboratory LMS and keeps the domain ready for later database modeling without over-engineering the system.

---

# Phase 2.3 — Domain Entities

**Project:** Laboratory Management System (LMS)

**Phase:** 2

**Sprint:** 2.3 — Domain Entities

**Status:** In Progress

**Date:** 13 September 2026

---

## 1. Phase Objective

This sprint documents the domain concepts that are required to support the laboratory workflow without yet designing the database schema.

The purpose is to distinguish between:

- true domain entities
- supporting operational concepts
- future expansion areas

No Prisma schema, migrations, controllers, routes, services, or authentication code were added during this sprint.

---

## 2. Candidate Entities Considered

The following concepts were evaluated against the actual laboratory workflow and the existing architecture decisions:

### 2.1 Laboratory

**Candidate status:** final MVP entity

**Why it exists:** The system is meant to support small laboratories and is aligned with future multi-tenancy.

**Real-world meaning:** The physical or operational laboratory organization that owns and manages its data.

**MVP question:** Yes, this is required for the platform architecture even before the full tenant model is implemented.

**Entity boundary:** It should remain a core concept, even if the complete tenant enforcement is deferred.

**Future dependency:** Multi-lab support, ownership, configuration, branding, and policy management.

### 2.2 User

**Candidate status:** final MVP entity, conceptual at this stage

**Why it exists:** The platform and laboratory require actor identities for administration and operations.

**Real-world meaning:** A person who interacts with the LMS, either as a platform administrator or as a laboratory administrator.

**MVP question:** Yes, conceptually required; actual database model remains deferred.

**Entity boundary:** The `User` concept is separate from the role logic. The role is not a separate database model yet, but the user identity is still a true domain concept.

**Future dependency:** Sign-in, session lifecycle, membership, user profile, audit trail, password/security handling.

### 2.3 Patient

**Candidate status:** final MVP entity

**Why it exists:** Patients are the primary subject of the laboratory process.

**Real-world meaning:** The person receiving services from the laboratory.

**MVP question:** Yes, essential to the core workflow.

**Entity boundary:** A patient is not the same as a test order or a report. It is the master identity around which all service history is built.

**Future dependency:** Patient history, patient lookup, duplicate resolution, consent and privacy controls.

### 2.4 Test Definition / Test Type

**Candidate status:** final MVP entity

**Why it exists:** A laboratory does not simply record a generic result; it usually defines what test is being performed.

**Real-world meaning:** The clinical or operational definition of a test available at the laboratory, such as a blood profile or urine analysis type.

**MVP question:** Yes, this is required to distinguish between a test being offered and an instance of that test being performed for a patient.

**Entity boundary:** This should not be confused with an ordered test instance.

**Future dependency:** Reference ranges, units, standardization, pricing, panel grouping, quality controls.

### 2.5 Test Order / Patient Test Instance

**Candidate status:** final MVP entity

**Why it exists:** A test is performed or ordered for a specific patient, at a specific time, as a specific instance.

**Real-world meaning:** The request or appointment for a patient to receive a given test.

**MVP question:** Yes, this is central to the workflow.

**Entity boundary:** This is distinct from the general test definition and from the final report outcome.

**Future dependency:** Scheduling, status tracking, urgency, sample collection, cancellations, re-tests.

### 2.6 Test Result / Result Set

**Candidate status:** final MVP entity

**Why it exists:** A test order may produce one or many values, structured fields, and reference-linked observations.

**Real-world meaning:** The actual values recorded for a test instance.

**MVP question:** Yes, because the workflow explicitly includes waiting for result entry and not just a simple free-text value.

**Entity boundary:** This is not the same as the test definition, and should not be conflated with the final report.

**Future dependency:** Validation rules, result interpretation, structured fields, abnormal flags, PDF attachments.

### 2.7 Report

**Candidate status:** final MVP entity

**Why it exists:** The final output to the patient is a report, often as a print-ready document or PDF.

**Real-world meaning:** The final presentation of one or more test results for a patient.

**MVP question:** Yes, because reports are part of the core laboratory output.

**Entity boundary:** A report should be treated as a final package or snapshot, not as a live calculation of patient data.

**Future dependency:** PDF generation, print workflows, report templates, revisions, sign-off, archival.

### 2.8 Payment / Billing

**Candidate status:** supporting entity

**Why it exists:** Payment handling is part of the operational business flow.

**Real-world meaning:** Charges, payments, outstanding balances, or billing records associated with a patient or order.

**MVP question:** Required operationally, but not necessarily the most central clinical entity.

**Entity boundary:** It should be treated as a supporting transactional concept that is tied to the laboratory's business operations.

**Future dependency:** invoices, receipts, discounts, installment plans, accounting integration.

### 2.9 Lab Configuration / Settings

**Candidate status:** supporting entity

**Why it exists:** The laboratory has configuration that changes over time.

**Real-world meaning:** Name, contact details, address, working hours, branding, testing pricing, operational defaults.

**MVP question:** Likely yes, but as operational metadata rather than primary workflow business logic.

**Entity boundary:** It should be conceptually separate from patient and test-order records.

**Future dependency:** branding, policy configuration, tax settings, service definitions.

### 2.10 Report Template

**Candidate status:** supporting or future entity

**Why it exists:** Reports may have standard layouts, formatting, and sections.

**Real-world meaning:** A reusable report format for lab-produced output.

**MVP question:** Not strictly required to define the domain model at this stage, unless templates become a clear requirement before implementation.

**Entity boundary:** It can be modeled later as a supporting concept if the lab wants consistent report styling.

**Future dependency:** PDF templates, print layouts, branding, dynamic sections.

### 2.11 Test Parameter / Result Field Definition

**Candidate status:** supporting entity

**Why it exists:** Some tests produce structured results with multiple fields rather than a single text value.

**Real-world meaning:** A defined field such as a numeric value, unit, reference range, normal flag, or qualitative measure attached to a test type.

**MVP question:** Likely yes in concept, but not yet a database decision.

**Entity boundary:** This is not the same as a single test result value. It represents a field definition or result structure.

**Future dependency:** structured result validation, reference intervals, units, interpretation logic.

### 2.12 Visit / Encounter

**Candidate status:** future or supporting concept, not yet required

**Why it exists:** Some systems need to distinguish a patient visit from test history.

**Real-world meaning:** A patient visit or encounter that groups several related services.

**MVP question:** Not clear from the current requirements. This should not be introduced prematurely.

**Entity boundary:** Could emerge later if the workflow requires grouping multiple orders under one visit.

**Future dependency:** appointment management, billing grouping, operational workflow tracking.

---

## 3. Final MVP Entity Set

The following are the main domain entities that should be treated as the core workflow for the initial LMS implementation:

### 3.1 Laboratory

**Responsibility:** Represents the lab entity to which operational data belongs.

**Why it exists:** The system needs to know which operational records belong to which laboratory, even if the full multi-tenancy enforcement is deferred.

### 3.2 User

**Responsibility:** Represents a system actor, especially the platform `SUPERADMIN` and the laboratory `LAB_ADMIN`.

**Why it exists:** Authentication and role ownership will eventually depend on this identity.

### 3.3 Patient

**Responsibility:** Represents the person receiving testing services.

**Why it exists:** Every test, report, and payment chain ultimately belongs to a patient.

### 3.4 Test Definition / Test Type

**Responsibility:** Represents what the laboratory offers or performs.

**Why it exists:** The system must distinguish test catalog items from actual patient requests.

### 3.5 Test Order / Patient Test Instance

**Responsibility:** Represents a specific request or instance of a test for a patient.

**Why it exists:** Patient may have tests performed at different times, and one patient can have numerous ordered tests over time.

### 3.6 Test Result / Result Set

**Responsibility:** Represents the values recorded for an ordered test instance.

**Why it exists:** The workflow includes waiting, entry, and structured result capture.

### 3.7 Report

**Responsibility:** Represents the final clinical output for a patient.

**Why it exists:** The report is the deliverable that combines one or more results and is often printed or retained as a PDF.

---

## 4. Supporting Entities

These are likely to matter in a robust implementation but are not the core of the fundamental workflow:

- Payment / billing
- Lab configuration / settings
- Report template
- Test parameter / result field definition
- Document artifact or PDF file reference
- Audit trail or operational log

These concepts should be designed only when the workflow and business rules are clear enough for a production-grade model.

---

## 5. Future Entities

These should not be implemented as part of the current domain design because they are not yet required by the MVP and would add complexity without clear benefit:

- detailed role hierarchy beyond `SUPERADMIN` and `LAB_ADMIN`
- receptionist, technician, doctor, cashier, or pathologist identities
- staff scheduling and shift management
- supplier or inventory management
- external referral workflows
- quality control and calibration tracking
- advanced accounting modules
- invoice/tax systems
- complex approval workflows
- appointment management systems

These may become necessary later, but they should not be introduced now simply because the domain appears broad.

---

## 6. Important Domain Boundaries

The key distinction is that the system must not confuse these four concepts:

### 6.1 Test definition vs test order

A test definition describes what test exists in the laboratory catalog.

A test order is one specific occurrence for one patient and one time period.

### 6.2 Test order vs test result

A test order is the request.

A test result is the recorded outcome of that request.

### 6.3 Test result vs report

A result is a raw or structured data point associated with a test order.

A report is the final presentation, often combining multiple results and delivering them to the patient.

### 6.4 Patient data vs laboratory configuration

Patient data is tied to the patient record and treatment history.

Laboratory configuration is tied to the lab's operational setup and may change over time without changing the historical record of a patient case.

These boundaries are important because they determine how historical integrity is preserved.

---

## 7. Historical vs Current Data

The domain needs to distinguish between current/master data and transactional or historical data.

### 7.1 Current / Master Data

Examples include:

- laboratory identity and operational settings
- patient master identity
- user identity and role assignment
- test catalog definitions
- standard report or template definitions

These are not necessarily static forever, but they represent the “current truth” used for ongoing operations.

### 7.2 Transactional Data

Examples include:

- patient test orders
- recorded results
- report generation events
- payment records

These represent actual operational events and should remain traceable over time.

### 7.3 Historical Records

Examples include:

- patient phone number history
- older test definitions and reference ranges
- previous report snapshots
- prior billing state

Historical records are important because:

- a patient’s phone number may change
- a test definition may later be updated
- a lab’s configuration may change over time
- a report should remain accurate even if current configuration changes

The system should therefore treat reports and historical records as snapshots, not as live queries over today's master data.

---

## 8. Why This Model Is Appropriate for the MVP

This model keeps the domain focused on real clinical workflow while avoiding schema-level over-engineering.

The design is intentionally conservative:

- real workflow is centered on patient, test order, result, and report
- operational concepts like payment and settings are recognized but not allowed to dominate the core design
- future complexity is deferred instead of assumed

This keeps the MVP small-laboratory friendly and aligned with the Phase 2.2 role decision.

---

## 9. Assumptions Still Needing Validation

The following questions need future validation before database design begins:

1. Is a patient unique by lab, by platform, or by both?
2. Is a test definition shared across the platform or defined per laboratory?
3. Are reports always generated from one order, or can a report include multiple orders or multiple visits?
4. Are structured results always defined by the test type, or does a lab need custom result fields per order?
5. Is payment recorded per order, per patient, or per reporting cycle?
6. Should reports be snapshots stored as historical artifacts or generated dynamically from current data?
7. Does every laboratory need its own PDF/report-generation configuration, or is this platform-level?
8. Should patient identity be normalized around CNIC only, or should additional identifiers be supported later?

These questions should be resolved in future domain/design refinement, not in the current sprint.

---

## 10. Architectural Summary

The LMS domain should be driven by the actual service flow rather than by abstract organizational labels.

The core of the system is:

- laboratory
- user
- patient
- test definition
- test order
- result
- report

Supporting concepts such as payment and configuration matter, but they should not distort the core workflow design.

This sprint establishes the conceptual domain boundaries and historical-data concerns that the later database design work must respect.

---

## 11. Final Position for Phase 2.3

The phase does not yet decide the database schema.

It defines the conceptual domain model that future Prisma design work must be based on:

- few core entities
- clear responsibilities
- no premature role complexity
- strong historical-record awareness
- no over-engineering beyond the small-laboratory MVP

---

# Phase 2.4 — Entity Relationships

**Project:** Laboratory Management System (LMS)

**Phase:** 2

**Sprint:** 2.4 — Entity Relationships

**Status:** In Progress

**Date:** 13 September 2026

---

## 1. Phase Objective

This sprint defines the conceptual relationships among the approved domain entities before any actual database design work begins.

The goal is to decide how core operational entities relate to each other while preserving the architectural constraints established in Phase 2.2 and Phase 2.3:

- `SUPERADMIN` remains platform-level
- `LAB_ADMIN` remains laboratory-bound
- the architecture remains intentionally simple for small laboratories
- no Prisma models, migrations, or implementation code are created in this sprint

---

## 2. Final Relationship Model

The final conceptual model is:

```text
Laboratory
├── Users
├── Patients
├── Test Definitions
├── Test Orders
├── Test Results
├── Reports
├── Payments / Billing
├── Lab Configuration
└── Audit Records

User
├── SUPERADMIN
└── LAB_ADMIN

Patient
├── belongs to one Laboratory (for MVP)
├── has many Test Orders
└── has many Payments / Billing records

Test Definition
├── belongs to one Laboratory
├── is used by many Test Orders
├── defines many Result Fields / Parameters
└── may be referenced by many Reports

Test Order
├── belongs to one Patient
├── belongs to one Laboratory
├── references one Test Definition (or a collection of test definitions if grouped)
├── can produce many Test Results
├── can produce one or many Reports
└── can have many Payment records

Test Result
├── belongs to one Test Order
├── may belong to one specific test item within the order
├── may have many Result Fields / Parameters
└── is historically preserved as a result snapshot

Report
├── belongs to one Patient
├── belongs to one Laboratory
├── is generated from one or more Test Orders
├── is a finalized presentation of results
└── should be treated as a historical snapshot

Payment
├── belongs to one Patient
├── belongs to one Laboratory
├── may be tied to one Test Order or to a collection of orders
└── should remain historically traceable
```

---

## 3. Relationship Decisions by Entity

### 3.1 Laboratory to User

**Relationship:** `Laboratory` to `User`

**Type:** `1:N`

**Cardinality:** One laboratory can have many users; each user belongs to one laboratory at the laboratory-user boundary.

**Ownership/tenancy:** Laboratory-owned operational user membership.

**Why:** The MVP supports multiple users per lab, but the role model remains minimal and does not create a broad employee hierarchy.

**Note:** This relationship is not the same as platform-level `SUPERADMIN`, which is not restricted to one laboratory.

### 3.2 Laboratory to Patient

**Relationship:** `Laboratory` to `Patient`

**Type:** `1:N`

**Cardinality:** One laboratory has many patients; each patient belongs to one laboratory in the MVP.

**Ownership/tenancy:** Laboratory-owned patient data.

**Why:** The requirement states that patient records must be considered in relation to laboratory ownership and the system is intended to support multiple laboratories.

**Decision:** For the MVP, the simplest correct choice is: `Patient belongs to exactly one laboratory`.

**Reasoning:** This preserves a clean “lab-owned operational data” model and avoids cross-laboratory patient ambiguity in the early architecture. It is simpler and more correct than a globally shared patient record.

### 3.3 Laboratory to Test Definition

**Relationship:** `Laboratory` to `Test Definition`

**Type:** `1:N`

**Cardinality:** One laboratory can define many tests; each test definition belongs to one laboratory.

**Ownership/tenancy:** Laboratory-owned test catalog.

**Why:** Different laboratories may offer different tests, price lists, methods, reference ranges, and report layouts.

**Decision:** `Test Definition` should be laboratory-owned for the MVP.

**Reasoning:** This is the simplest model that supports a real small-lab environment without forcing the platform to invent a global catalog that may not match actual lab differences.

**Rejected alternative:** Global test catalog with lab-specific overlays.

**Why rejected:** It adds complexity without clear immediate value. The foundation architecture should remain simple until a real need for a shared catalog emerges.

### 3.4 Patient to Test Order

**Relationship:** `Patient` to `Test Order`

**Type:** `1:N`

**Cardinality:** One patient can have many test orders; each test order belongs to one patient.

**Ownership/tenancy:** Patient and order are both laboratory-scoped in the MVP.

**Why:** A patient may return repeatedly and may have multiple tests over time.

### 3.5 Test Order to Test Definition

**Relationship:** `Test Order` to `Test Definition`

**Type:** `N:1` conceptually from the order side

**Cardinality:** Many test orders may reference the same test definition; each order references a specific test definition.

**Ownership/tenancy:** Laboratory-owned meaning, because the definition and the order both live under the same laboratory in the MVP.

**Why:** A test definition represents the catalog item; a test order represents the patient-specific request for that catalog item.

### 3.6 Test Order to Test Result

**Relationship:** `Test Order` to `Test Result`

**Type:** `1:N`

**Cardinality:** One test order may produce many result records; each result belongs to one order.

**Why:** Different tests may record structured result sets or multiple result values. A single order may include multiple test items, and each item may yield a result.

### 3.7 Patient to Report

**Relationship:** `Patient` to `Report`

**Type:** `1:N`

**Cardinality:** One patient can have many reports; each report belongs to one patient.

**Ownership/tenancy:** Laboratory-owned historical document data.

**Why:** Reports represent finalized patient outputs over time.

### 3.8 Test Order to Payment

**Relationship:** `Test Order` to `Payment`

**Type:** `1:N` for the simple MVP

**Cardinality:** One order may have many payment events; each payment event is tied to an order.

**Ownership/tenancy:** Laboratory-owned operational transaction data.

**Why:** Payment is associated with the laboratory service event, not just the person.

**Note:** This is a better conceptual boundary than attaching payment directly to patient alone.

### 3.9 Patient to Payment

**Relationship:** `Patient` to `Payment`

**Type:** `1:N`

**Cardinality:** One patient may have many payment records; each payment record belongs to one patient.

**Ownership/tenancy:** Laboratory-owned payment records.

**Why:** Payment is still traceable to the patient as the payer/subject, but the underlying service event should remain the business anchor.

**Interpretation:** Payment may be conceptually attached to both patient and order. For the MVP, `Test Order` is the more important operational relationship; `Patient` is the person-level context.

---

## 4. Final Decision on Test Order Structure

This is the most important structural decision in the domain model.

### Decision

A `Test Order` should represent a patient-specific request for one or more test items within a service event.

It should not be used as a synonym for a single test definition or a single result.

### Preferred conceptual structure

```text
Patient
  └── Test Order
        ├── ordered test item 1
        ├── ordered test item 2
        └── ordered test item N
              └── Test Result
```

### Meaning

- `Patient` is the subject of care.
- `Test Order` is the service request associated with the patient, often created during a visit or billing event.
- `Test Definition` describes the test the laboratory offers.
- `Test Result` belongs to a specific ordered test item within that order.

### Cardinality interpretation

- `Patient` to `Test Order`: `1:N`
- `Test Order` to `Test Definition`: `N:1` at the conceptual level, or `1:N` if each order is treated as containing multiple order items
- `Test Order` to `Test Result`: `1:N`

### Why this structure is correct

This model is flexible enough for:

- one patient with multiple tests in one visit
- multiple visits over time
- multiple result values per test
- future item-level billing or status tracking

### Rejected alternative

A `Test Order` representing exactly one test only.

**Why rejected:** It creates an awkward model for the realistic case where one patient visit can contain several tests. The later database design can still keep a simple item-based representation, but the conceptual model should be robust to grouped requests.

---

## 5. Final Decision on Test Result Relationship

### Decision

A `Test Result` belongs to a specific performed/ordered test instance, not directly to the patient and not only to the generic test definition.

The conceptual path is:

```text
Patient
  └── Test Order
        └── Ordered Test Item
              └── Test Result
```

### Why this matters

A result must be attached to the actual service request for that patient:

- the same test definition can be ordered repeatedly for different patients
- the same patient can have the same test more than once
- a single order can contain multiple tests
- different tests have different result structures

### Result structure guidance

The domain should not force every result into one generic field.

Instead, the result model should support:

- single numeric values
- multiple numeric values
- categorical or textual values
- parameter-based structured result sets

The database modeling later must preserve this flexibility without over-engineering the initial schema.

### Rejected alternative

`Test Result` directly attached only to `Patient` or only to `Test Definition`.

**Why rejected:** That loses the important link between the specific request and the actual outcome. The patient and the test definition are not sufficient to capture the historical fact that a given ordered test instance produced a given result.

---

## 6. Test Parameters / Result Fields Decision

### Decision

`Test Parameter` / `Result Field Definition` should belong conceptually to the `Test Definition`, while the actual parameter values belong to the `Test Result`.

### Reasoning

These are conceptually different:

- `Test Definition`: “CBC includes Hemoglobin, WBC, Platelets”
- `Test Result`: “This patient’s CBC had Hemoglobin = X, WBC = Y, Platelets = Z”

### Relationship

- `Test Definition` defines the expected parameter structure.
- `Test Result` records the actual parameter values for a specific ordered test instance.

### Cardinality concept

- `Test Definition` to `Result Field Definition`: `1:N`
- `Test Result` to `Result Field Value`: `1:N`

### Why this is the correct split

This preserves the distinction between the lab’s catalog of supported fields and the patient-specific result data collected at execution time.

### Rejected alternative

Attaching parameter definitions directly to the result record only.

**Why rejected:** It hides the reusable definition of what a test produces. Different patients may have different values, but the same test type usually shares the same structural definition.

---

## 7. Report Relationship Decision

### Decision

A `Report` is a finalized presentation of results for a patient and should be treated as a historical snapshot, not as a live view over current data.

### Relationship model

- One `Report` belongs to one `Patient`.
- One `Report` can summarize multiple `Test Orders` and multiple `Test Results`.
- One `Test Order` can contribute to one or more reports over time, depending on workflow and versioning.
- A report is not the same as a test result; it is a final presentation layer.

### Recommended MVP conceptual model

```text
Patient
 └── Report
       └── contains one or more finalized result sets
```

### Why this is appropriate

- The workflow says reports are finalized and printed or retained digitally.
- A report should preserve the meaning of historical data.
- A report may aggregate multiple test results into a single patient document.
- A report should not silently change when a current test definition or lab setting changes.

### Rejected alternatives

#### One report per test only

**Why rejected:** Real reports often combine multiple ordered tests into one patient document.

#### One report per order only

**Why rejected:** This is too narrow if a lab later reissues or revises reports based on finalization steps.

#### Reporting as a dynamic live view only

**Why rejected:** This fails historical integrity requirements because current definitions may change and alter older reports.

---

## 8. Payment Relationship Decision

### Decision

Payment should be treated as a transactional entity tied to the laboratory service event, with patient-level context preserved for the payer.

### Recommended conceptual structure

```text
Patient
 └── Test Order
       └── Payment
```

### Why this is the best MVP boundary

- A patient may have many transaction records.
- An order may contain multiple tests.
- Payment may occur before or after results are finalized.
- Payment is operationally linked to the service event, not merely to the person.
- Historical traceability is essential.

### Relationship summary

- `Patient` to `Payment`: `1:N`
- `Test Order` to `Payment`: `1:N` (preferred operational anchor)
- `Payment` to `Report`: not required at the core MVP; report is a presentation layer, not necessarily the payment anchor

### Rejected alternative

Attaching payment directly only to `Patient`.

**Why rejected:** It hides the actual service being billed and creates a weak foundation for multi-item orders and partial or staged payments.

### Future extension

The architecture should allow for future partial payment or invoice-style processing without forcing the full accounting model today.

---

## 9. Laboratory Configuration Ownership

### Decision

Configuration should be conceptually owned by `Laboratory`, not by `Patient` or `Test Definition` alone.

### Examples of lab-level configuration

- lab name, address, contact information
- working hours
- local operational defaults
- report header branding
- pricing defaults
- test catalog settings

### Distinction

- `Laboratory` owns the configuration context.
- `Test Definition` owns the test-specific metadata and possibly test-specific reference data.
- `Report Template` may be a supporting concept that helps standardize report output, but it is not the same as laboratory configuration.

### Why this is correct

The system is operating in a multi-laboratory context, and lab-specific configuration naturally belongs to the lab as the operational tenant context.

---

## 10. Historical Integrity Decisions

Historical integrity is an explicit requirement for the LMS. The system must preserve the meaning of past reports and results even if current master data changes.

### What must be preserved conceptually

#### 10.1 Test reference data

If a test definition’s reference range or result interpretation changes in the future, previously generated reports should not retroactively change meaning.

**Conceptual requirement:** report/result history should preserve the reference context used at the time of issue.

#### 10.2 Laboratory configuration

If the laboratory name, address, logo, or report header changes, older finalized reports should remain historically accurate.

**Conceptual requirement:** finalized reports must retain the configuration snapshot used when the report was created.

#### 10.3 Patient identity changes

A patient’s phone number or address may change over time.

**Conceptual requirement:** current patient data should not overwrite the historical context of prior reports or treatment records without a clear audit trail or snapshot concept.

#### 10.4 Report snapshots

Reports should be treated as finalized snapshots, not as live dynamic views built from the current data store.

**Conceptual requirement:** report generation must preserve the data set used to create the final document.

### Important architectural conclusion

The domain must support historical snapshots at least conceptually, even though snapshot fields or storage patterns are not being designed in this sprint.

---

## 11. Rejected Alternatives and Why They Were Rejected

### 11.1 Global shared patient model across all laboratories

**Rejected because:** it creates ambiguity in a multi-lab platform and conflicts with the small-lab operational need for lab-owned patient records.

### 11.2 Global test catalog for all laboratories

**Rejected because:** different laboratories may offer different tests, prices, reference ranges, and report formats.

### 11.3 Test Order as a single test only

**Rejected because:** the real workflow often includes multiple tests in one visit and multiple result items per order.

### 11.4 Test Result attached directly to Patient or Test Definition only

**Rejected because:** it loses the relationship to the specific test instance being performed.

### 11.5 Payment attached only to Patient

**Rejected because:** it ignores the service event/transaction that actually created the bill.

### 11.6 Report as a live dynamic view only

**Rejected because:** it does not satisfy the requirement that finalized reports remain historically stable.

### 11.7 Full role hierarchy for small-lab MVP

**Rejected because:** it contradicts the intentionally simple architecture chosen in Phase 2.2.

---

## 12. Cardinality Summary

### Entity relationships

- `Laboratory` to `User`: `1:N`
- `Laboratory` to `Patient`: `1:N`
- `Laboratory` to `Test Definition`: `1:N`
- `Patient` to `Test Order`: `1:N`
- `Test Order` to `Test Result`: `1:N`
- `Patient` to `Report`: `1:N`
- `Patient` to `Payment`: `1:N`
- `Test Order` to `Payment`: `1:N`
- `Test Definition` to `Result Field Definition`: `1:N`
- `Test Result` to `Result Field Value`: `1:N`

### N:M resolution note

If a future requirement introduces a case where the same patient order includes many test definitions and the same test definition is used across many patient orders, the relationship should be modeled through an associative concept such as an order item rather than by treating the order as a single flat record.

This ensures the domain remains conceptually precise.

---

## 13. Remaining Architectural Questions

The following questions remain open and should be resolved in later design work, but they should not be overbuilt in this sprint:

1. Should a patient record be tied to exactly one laboratory, or should the system support a future patient cross-reference model?
2. Should a single test order always contain multiple ordered test items, or is one-item-per-order acceptable for the MVP?
3. Should a report be generated once per order, once per patient visit, or only when finalized by the lab?
4. Should payment be tied strictly to the order, or should a patient-level summary also be kept for UX and operational reporting?
5. Should report templates be lab-specific or platform-level defaults?
6. Should result parameter definitions be standardized at the lab level or shared across all labs?

These questions are best handled later when the actual application workflow is validated against the laboratories that will use the system.

---

## 14. Final Architectural Position for Phase 2.4

The relationship model for the MVP is intentionally simple but structurally sound:

- `Laboratory` owns most operational data.
- `Patient` belongs to one laboratory in the MVP.
- `Test Definition` belongs to one laboratory.
- `Test Order` captures the patient-specific service request.
- `Test Result` belongs to the ordered test instance.
- `Report` is a finalized, historically meaningful presentation of results.
- `Payment` is tied to the service event and patient context.
- historical snapshots are conceptually required for reports, reference data, and lab configuration changes.

This gives a clear, scalable foundation for later database design without prematurely over-modeling the system.
