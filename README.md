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

## Directory Structure

```text
internal_portal_ceo_dashboard_front/
├── index.html                   # Web HTML entry point
├── index.js                     # Mobile Expo entry point
├── app.json                     # Expo mobile app configuration & URL scheme
├── vite.config.ts               # Vite configuration with aliases for react-native-web
├── scripts/
│   └── start-android.js         # Automated emulator launch & ADB reverse forwarder
├── src/
│   ├── App.tsx                  # Web root navigation
│   ├── App.native.tsx           # Mobile root navigation (NativeStack)
│   ├── components/
│   │   ├── native/              # Universal primitives (Cards, Buttons, Badges)
│   │   └── ui/                  # Web shadcn UI primitives
│   ├── lib/
│   │   ├── AuthContext.tsx      # Universal auth state & deep link handler
│   │   ├── env.ts               # Universal environment variables reader
│   │   └── storage.ts           # Unified storage abstraction
│   ├── pages/
│   │   ├── Dashboard.tsx / Dashboard.native.tsx
│   │   ├── Login.tsx / Login.native.tsx
│   │   ├── MergersAcquisitions.tsx / MergersAcquisitions.native.tsx
│   │   ├── UploadFiles.tsx / UploadFiles.native.tsx
│   │   ├── PendingAccess.tsx / PendingAccess.native.tsx
│   │   └── Log/ (AuditLog.tsx / AuditLog.native.tsx)
│   └── services/
│       ├── apiClient.ts         # Central API requester
│       └── mergersAcquisitionsService.ts
├── package.json
└── tsconfig.json
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
