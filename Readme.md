# Laboratory Management System (LMS)

## Project status

| Phase | Status |
| --- | --- |
| Phase 0 — Project Foundation | Complete |
| Phase 1 — Database Foundation | Complete |
| Phase 2 — Database Domain Architecture | MVP domain implemented; see phase record |
| Phase 3 — Backend API Foundation | Complete |
| Phase 4 — Frontend MVP | **COMPLETE** |
| Next stage — MVP QA and release preparation | Pending |

The working application is split into `Server/` (Express, Prisma, PostgreSQL API) and `Client/` (React/Vite frontend). Phase documentation is in `Docs/phases/`; the Phase 4 record documents the implemented frontend MVP and its current boundaries.

## PostHog analytics

The client initializes PostHog only when `VITE_POSTHOG_KEY` is configured. Set
`VITE_POSTHOG_HOST` to the PostHog host for the project, or omit it to use the
US Cloud default (`https://us.i.posthog.com`):

```env
VITE_POSTHOG_KEY=your-project-key
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Analytics tracks page navigation and selected successful workflow events. It
uses internal user IDs plus role and laboratory scope, and does not send
patient, result, credential, or token data.
