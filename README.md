# CEO Dashboard - Frontend (Universal Web & Mobile App)

Cross-platform executive frontend portal for the **ZenaTech CEO Dashboard**. Engineered with platform-specific extensions (`.tsx` for Desktop Web and `.native.tsx` for iOS / Android Mobile) to deliver an optimized experience across all executive devices.

Built with **React 19**, **Vite 8**, **Tailwind CSS v4**, **shadcn/ui**, **Expo 52+**, and **React Native 0.76+**.

---

## System Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientPlatforms [Executive Devices]
        WebBrowser[Desktop Web Browser :5175]
        MobileApp[iOS / Android Mobile Devices :8090]
        Emulator[Android Emulator via ADB Reverse]
    end

    subgraph DualBuildSystem [Dual Bundling Architecture]
        ViteBundler[Vite 8 Web Bundler + react-native-web]
        MetroBundler[Expo Metro Bundler on Port 8090]
    end

    subgraph UniversalSharedCode [Universal Component & State Fabric]
        UniversalAuth[AuthContext & Secure Token Storage]
        UniversalEnv[Universal Env Configuration Loader]
        QueryCache[TanStack React Query v5 Data Layer]
        StorageLayer[Unified Storage: LocalStorage / AsyncStorage]
    end

    subgraph ScreenImplementations [Platform-Optimized Views]
        WebViews[Web Pages: Dashboard, M&A, Ingest, Audit]
        NativeViews[Native Views: Executive Drawer, Touch Badges]
    end

    subgraph BackendAPI [FastAPI CEO Gateway :8005]
        RESTEndpoints[/api/dashboard, /api/mergers-acquisitions]
        SSEEndpoint[/api/notifications/stream]
    end

    WebBrowser --> ViteBundler
    MobileApp --> MetroBundler
    Emulator --> MetroBundler

    ViteBundler --> WebViews
    MetroBundler --> NativeViews

    WebViews --> UniversalSharedCode
    NativeViews --> UniversalSharedCode

    UniversalSharedCode --> QueryCache
    QueryCache --> RESTEndpoints
    UniversalSharedCode <--> SSEEndpoint
```

---

## Technologies & System Specifications

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Web Framework & Build** | [React 19](https://react.dev/), [Vite 8](https://vitejs.dev/) | High-speed single page web application running on port `5175` |
| **Mobile Framework** | [Expo 52+](https://expo.dev/), [React Native 0.76+](https://reactnative.dev/) | Cross-platform native mobile engine targeting Android & iOS on port `8090` |
| **Universal Web Polyfill**| `react-native-web`, `codegenShim.ts` | Allows universal primitives to render seamlessly across DOM and Native targets |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Shared schemas and unified prop definitions across web and mobile views |
| **Web Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com/), `@shadcn/react`, `next-themes` | Modern utility-first CSS tokens, dark mode toggle, and glassmorphic card styles |
| **Native Navigation** | `@react-navigation/native`, `@react-navigation/native-stack` | High-performance 60fps native screen transitions and gesture navigation |
| **Data Fetching & Cache**| [TanStack React Query v5](https://tanstack.com/query) | Stale-while-revalidate client caching, optimistic updates, and background refetching |
| **Visualizations** | [Recharts](https://recharts.org/), `react-native-svg` | Executive KPI charts, deal valuation breakdowns, and latency metrics |
| **Authentication & SSO**| `expo-web-browser`, `expo-linking`, `AuthContext` | Microsoft Entra ID SSO with automatic browser-to-app deep linking |

---

## Port Allocation & Dev Scripts

| Service | Port | Description |
| :--- | :--- | :--- |
| **Vite Web Dev Server** | `5175` | Serves web app and handles OAuth redirect callbacks |
| **Expo Metro Bundler** | `8090` | Bundles React Native code for mobile |
| **FastAPI Backend API** | `8005` | REST API, PostgreSQL database & Auth provider |

---

## Quick Start & Running Options

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables (.env)
```env
VITE_API_BASE_URL=http://localhost:8005
EXPO_PUBLIC_API_BASE_URL=http://localhost:8005
```

### 3. Run Web & Mobile Concurrently (Recommended)
Starts both the **Expo Metro Bundler** (port `8090`) and the **Vite Web Dev Server** (port `5175`):
```bash
npm start
```

### 4. Run Web Application Only
```bash
npm run dev
```
Open `http://localhost:5175`.

### 5. Run Mobile on Android Emulator
Auto-launches Android emulator, sets up ADB reverse port forwarding (`8090`, `8005`, `5175`), and boots Expo:
```bash
npm run android
```

### 6. Instant Reload on Emulator
```bash
npm run reload
```

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

Root files outside `src/`:

```text
index.html                  # Web HTML entry point
index.js                    # Mobile Expo entry (registers src/App.native.tsx)
app.json                    # Expo app configuration
metro.config.js             # Metro (mobile) bundler config, `@/` alias
vite.config.ts              # Vite config with react-native-web aliases
scripts/                    # Android emulator launch, ADB reverse and reload helpers
```

---

## Build & Quality Checks

```bash
# Type-check and build web bundle
npm run build

# Run linter
npm run lint

# Preview production web build
npm run preview
```
