---
trigger: model_decision
description: Project directory layout and code organization.
---

<!-- project-structure:start -->
## Project Structure

```text
src/
  assets/                   # Images and icons
  components/               # Reusable UI, one folder per feature
    Administration/         # Administration widgets (assign approvers modal)
    AppShell/               # Layout chrome: sidebar, top bar, navigation, breadcrumbs, floating AI chat, session timeout
    Dashboard/              # Dashboard KPI cards, charts and tables
    common/                 # Shared by several pages: error boundaries, widget resilience wrapper, route guard
    native/                 # Universal React Native primitives for the mobile app
    ui/                     # shadcn/ui primitives (button, dialog, ...); don't put feature code here
  hooks/                    # Custom React hooks
  lib/                      # App-wide helpers: auth context, env, storage, utils
  pages/                    # One folder per feature/route group
    Administration/         # Administration portal view: approvals, approver assignment
    Auth/                   # Login and pending-access screens
    Dashboard/              # Home dashboard
    Log/                    # Audit log
    MergersAcquisitions/    # Mergers & Acquisitions deals and pipeline
    Reports/                # Reports page (not routed yet)
    Settings/               # User settings
    UploadFiles/            # File uploads and upload archive
  services/                 # API calls: apiClient + one <feature>Service.ts per backend area
  template/                 # Excel templates (bank reconciliation)
  types/                    # TypeScript types, one file per feature
  App.native.tsx            # Mobile (Expo) entry and navigation
  App.tsx                   # Web routes (React Router)
  main.tsx                  # Web entry: providers and router
```

### Where new code goes

* **New page:** `src/pages/<Feature>/`. Pages that belong together share a folder; a `.native.tsx` variant sits next to its web file.
* **Components:** used by one feature go in `src/components/<Feature>/`; used by several go in `src/components/common/`. `src/components/ui/` is only for shadcn primitives.
* **New API calls** go in `src/services/<feature>Service.ts` through `apiClient`, not `fetch` inside components (some older pages still do this; move those calls when you touch them). Types go in `src/types/<feature>.ts`.
* **Don't add loose files** to `src/pages/` or `src/components/`.
* **When you move a file,** update every import to it (and the imports inside it), then run `npm run build` (`tsc -b && vite build`).
<!-- project-structure:end -->
