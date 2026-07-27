# Claude Project Skill

Lean rules for this enterprise internal portal.

## Stack

- React, TypeScript, Vite, Tailwind, shadcn UI, React Query.
- API calls go through `src/services/apiClient.ts`; shared API/domain types live in `src/types/*`.
- Services and hooks must not export shared types; use `import type`.

## Frontend

- Put reusable backend shapes in `src/types`; keep one-off props local.
- Prefer shadcn components from `src/components/ui`.
- Services are API wrappers only; hooks only coordinate React Query/server state.
- Use theme tokens and shadcn variants for dark mode.
- Preserve finance math: bank/income add; expenses/credit cards subtract; liability increases are negative.

## Backend

- Keep explicit request/response schemas aligned with frontend `src/types`.
- Preserve route groups: `/accounting`, `/bank_statement`, `/dashboard`, `/reports`, `/upload-files`.
- Uploads use multipart form data, stable IDs/metadata, and S3-swappable local storage.
- Avoid destructive accounting operations unless route and UI explicitly say replace.

## Checks

- Frontend: run `npm run build` after code changes.
- Run `npm run lint` after broad/shared changes.
- Backend: run the backend suite or touched endpoint tests.
