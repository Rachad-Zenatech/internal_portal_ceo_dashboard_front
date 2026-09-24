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
  * **NEVER** use polling loops (`check -> sleep -> check`) or database polling heartbeats inside SSE streaming endpoints.
  * **NEVER** query the database repeatedly inside SSE stream generators.
  * **Always** use `await event_queue.get()` (or `asyncio.wait_for(q.get(), timeout=30.0)` for lightweight ping) to suspend the coroutine at the event loop level with zero CPU/DB overhead until a published event arrives.

* **Architecture Recommendation:**
  > **SSE + event-driven backend + 30–60 second lightweight heartbeat + automatic reconnect.**
  >
  > Don't use the heartbeat to poll the database.
  >
  > That gives you:
  > ```text
  > No notification
  >       ↓
  > Server mostly waits
  >       ↓
  > Tiny heartbeat occasionally
  >       ↓
  > Notification occurs
  >       ↓
  > Immediate SSE event
  > ```
  > That is a much better balance between server load and connection reliability.
  > And your CloudFront test strongly suggests that completely silent SSE connections are not viable in your current setup.

  * Standard SSE generator implementation (with lightweight zero-DB heartbeat):
    ```python
    async def event_generator():
        q = asyncio.Queue()
        broadcaster.add_listener(q)
        try:
            yield ": connected

"
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=30.0)
                    if msg.user_id == "*" or str(msg.user_id).lower() == str(user_id).lower():
                        yield f"data: {msg.model_dump_json()}

"
                except asyncio.TimeoutError:
                    # Lightweight keep-alive comment/ping to prevent CloudFront/proxy timeouts without querying the database
                    yield ": ping

"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            broadcaster.remove_listener(q)
    ```
