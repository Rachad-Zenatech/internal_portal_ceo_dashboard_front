---
trigger: model_decision
description: Apply when modifying frontend code: stack, architecture conventions, real-time/SSE rules, platform parity and checks for this project.
---

# Project Guidelines

Lean rules for this enterprise internal portal.

## Stack

- React, TypeScript, Vite, Tailwind, shadcn UI, React Query.
- API calls go through `src/services/apiClient.ts`; no hardcoded base URLs elsewhere.
- Shared API/domain types live in `src/types/*`; services and hooks do not export them.

## Frontend

- Maintain full parity between Web (`.tsx`) and Mobile (`.native.tsx`). Whenever features, pages, or API integrations are modified or added on Web, the corresponding `.native.tsx` version must also be updated in tandem unless explicitly specified otherwise.
- Default list and data tables to clean pagination with 50 items per page.
- Put reusable backend shapes in `src/types`; use `import type`.
- Keep one-off prop types beside their component.
- Prefer shadcn components from `src/components/ui`.
- Hooks handle React Query orchestration; keep components thin.
- Use theme tokens and shadcn variants for dark mode.
- Preserve accounting math: bank/income add; expenses/credit cards subtract; liability increases are negative.
- Keep upload/archive flows non-destructive unless replacement is explicit.
- **New Connected Application Checklist (Mandatory):** Whenever a new internal application is integrated into the CEO Dashboard, always update the Centralized Dashboard and Customization system in the same task:
  1. Add the module key to `DataSourceModule` in `src/types/customize.ts`.
  2. Register its live data source(s) in `DATA_SOURCES` and `MODULE_LABELS` in `src/lib/dataSources.ts`.
  3. Add default widgets to `DASHBOARD_DEFAULTS` and create `<APP>_DEFAULTS` in `src/lib/boardDefaults.ts`.
  4. Create `src/pages/Customization/Customize<App>.tsx` and wire its route in `src/App.tsx` and sidebar link in `src/components/AppShell/Navigation.tsx`.
  5. Add the live summary card to `src/pages/Dashboard/PlatformPulseCards.tsx`, wire its query & refresh into `src/pages/Dashboard/Dashboard.tsx`, and link its tile in `src/pages/Dashboard/ConnectedPlatformsHub.tsx`.

## Backend

- Keep explicit request/response schemas aligned with frontend `src/types`.
- Uploads accept multipart form data and return stable IDs/metadata; local storage should remain S3-swappable.
- Do not silently delete or replace accounting data; use merge/update unless the endpoint and UI say replace.

## Checks

- Run `npm run build` after TypeScript or component changes.
- Run `npm run lint` after broad/shared changes.
- Backend changes: run the backend suite or touched endpoint tests.

### Server-Sent Events (SSE) & Real-Time Event Streaming
* **"Wait for Event" Model Only (Mandatory):**
  * **NEVER** use polling loops (`check -> sleep -> check`) or synthetic busy-wait heartbeats inside SSE streaming endpoints.
  * **NEVER** query the database repeatedly inside SSE stream generators.
  * **Always** use `await event_queue.get()` to suspend the coroutine at the event loop level with zero CPU overhead until a published event arrives.
  * Standard SSE generator implementation:
    ```python
    async def event_generator():
        q = asyncio.Queue()
        broadcaster.add_listener(q)
        try:
            yield ": connected\n\n"
            while True:
                msg = await q.get()  # Suspended with zero CPU until an event is pushed
                if msg.user_id == "*" or str(msg.user_id).lower() == str(user_id).lower():
                    yield f"data: {msg.model_dump_json()}\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            broadcaster.remove_listener(q)
    ```
