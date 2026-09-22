# Codex Project Skill

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
