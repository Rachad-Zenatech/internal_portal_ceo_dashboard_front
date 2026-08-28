# CEO Dashboard - Frontend (Web & Mobile)

Cross-platform frontend portal for the **ZenaTech CEO Dashboard**, supporting both a modern web application (React + Vite + Tailwind CSS + shadcn UI) and a native mobile application (Expo + React Native).

---

## Architecture Overview

The frontend codebase is architected with platform-specific extensions (`.tsx` for Web and `.native.tsx` for Mobile / React Native) ensuring full feature parity across desktop and mobile:

* **Web Portal (Vite)**: Runs as a single-page application at `http://localhost:5175`.
* **Mobile App (Expo / React Native)**: Runs via Metro Bundler on port `8090` targeting iOS & Android devices/emulators.

### Project Structure

```txt
frontend/internal_portal_ceo_dashboard_front/
├── index.html                     # Web HTML entry point
├── index.js                       # Mobile Expo entry point
├── app.json                       # Expo configuration & app scheme
├── vite.config.ts                 # Vite configuration (port 5175, proxy to backend)
├── scripts/
│   └── start-android.js           # Automated Android emulator & ADB reverse startup script
├── src/
│   ├── App.tsx                    # Web root navigation & layout
│   ├── App.native.tsx             # Mobile root navigation (NativeStack)
│   ├── components/
│   │   ├── native/                # Universal & native UI primitives (Cards, Buttons, Badges)
│   │   └── ui/                    # Web shadcn UI components
│   ├── lib/
│   │   ├── AuthContext.tsx        # Universal authentication context & permissions state
│   │   ├── env.ts                 # Universal environment config reader
│   │   └── storage.ts             # Unified storage (localStorage for Web / AsyncStorage for Native)
│   ├── pages/
│   │   ├── Dashboard.tsx          # Web CEO Dashboard
│   │   ├── Dashboard.native.tsx   # Mobile CEO Dashboard (with Portals Hub & Executive Drawer)
│   │   ├── Login.tsx              # Web Microsoft SSO Login
│   │   ├── Login.native.tsx       # Mobile Microsoft SSO & Direct Dev Login
│   │   ├── MergersAcquisitions.tsx         # Web M&A Target Pipeline (Paginated 50/page)
│   │   ├── MergersAcquisitions.native.tsx  # Mobile M&A Target Pipeline (Paginated 50/page)
│   │   ├── UploadFiles.tsx                 # Web File Ingestion & Archive (Paginated 50/page)
│   │   ├── UploadFiles.native.tsx          # Mobile File Ingestion & Archive (Paginated 50/page)
│   │   ├── PendingAccess.tsx               # Web Pending Access screen
│   │   ├── PendingAccess.native.tsx        # Mobile Pending Access screen
│   │   └── Log/
│   │       ├── AuditLog.tsx                # Web Administrative Audit Trail (Paginated 50/page)
│   │       └── AuditLog.native.tsx         # Mobile Administrative Audit Trail (Paginated 50/page)
│   └── services/
│       ├── apiClient.ts           # Central Axios client (routes requests to API base URL)
│       ├── mergersAcquisitionsService.ts   # M&A Pipeline & LOI tracking API
│       ├── uploadArchiveService.ts          # File upload & ingestion archive API
│       └── auditService.ts                  # Audit log & security events API
```

---

## Port Allocation

| Service | Port | Description |
| :--- | :--- | :--- |
| **Vite Web Dev Server** | `5175` | Serves web app and handles OAuth redirect callbacks |
| **Expo Metro Bundler** | `8090` | Bundles React Native code for mobile |
| **FastAPI Backend API** | `8005` | REST API, PostgreSQL database & Auth provider |

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root if custom endpoints are needed (defaults are built-in):

```env
# Web API base URL (defaults to http://localhost:8005)
VITE_API_BASE_URL=http://localhost:8005

# Expo / React Native API URL
EXPO_PUBLIC_API_BASE_URL=http://localhost:8005
```

---

## Running the Application

### Option A: Run Both Web & Mobile Concurrently (Recommended)

Starts both the **Expo Metro Bundler** (for Android emulator / mobile) on port `8090` and the **Vite Web Dev Server** on port `5175` concurrently:

```bash
npm start
```

### Option B: Run Web Application Only

Start the Vite development server on `http://localhost:5175`:

```bash
npm run dev
```

### Option C: Run Mobile Application (Android Emulator)

Detects/launches the **Pixel 7** Android emulator, configures ADB reverse port forwarding (`8090`, `8005`, `5175`), and starts Expo Metro:

```bash
npm run android
```

### Option D: Reload Mobile App on Android Emulator (Instant)

Re-syncs ADB reverse port forwarding and hot-reloads the Expo app on the connected emulator with the fresh bundle:

```bash
npm run reload
```

### Option E: Full Clean Restart (Web & Mobile)

Clears Metro bundler and Vite caches and restarts both dev servers cleanly:

```bash
npm run restart
```

### In-Terminal Hotkeys (when `npm start` is running)
* Press **`r`** in the Metro terminal to reload the mobile app.
* Press **`a`** to open/connect to the Android emulator.
* Press **`m`** to toggle the Expo Dev Menu.

---

## Features & Modules

### 1. CEO Dashboard (`/dashboard`)
* Executive KPI stat chips (Pending Approvals, Financials, Active Initiatives).
* Live System Status cards with auto-refresh and latency monitoring.
* Financial overview charts and breakdown widgets.
* Mobile Navigation Drawer and Quick Workflows Hub for instant portal access.

### 2. M&A Pipeline (`/mergers-acquisitions`)
* Acquisition candidates discovery and deal tracking.
* Metric cards (Total Deals, Under Review, LOI Accepted, Total Valuation).
* Search, sector filter chips, and clean 50-item pagination.
* Detailed deal inspection modals with valuation, EBITDA, and synergy ratings.

### 3. File & Data Ingestion (`/upload-files`)
* Multi-file ingestion and cloud archive tracking.
* Storage analytics KPIs (Total Ingested, Storage Used, Compression Ratio).
* Search, category filtering, and clean 50-item pagination.
* File detail inspection with metadata, byte sizes, and checksums.

### 4. System Audit Trail (`/log/audit-log`)
* Comprehensive administrative audit log and user authentication event tracker.
* Severity badge tagging (`INFO`, `WARNING`, `CRITICAL`, `ERROR`).
* Search and action filtering with clean 50-item pagination.
* Detail inspection modals with raw JSON metadata viewing.

---

## Authentication & Mobile Deep-Linking

* **Microsoft Entra SSO**:
  * The user taps **"Sign in with Microsoft"**, opening an in-app browser (`WebBrowser.openAuthSessionAsync`).
  * After Microsoft authenticates, the backend redirects to `http://localhost:5175/login?status=success&token=...`.
  * The callback triggers an Expo deep link (`exp://localhost:8090/--/login?token=...`), automatically dismissing Chrome and returning session control to React Native.
* **Developer Direct Login**:
  * In `Login.native.tsx`, a **"Direct Dev Sign In"** button is available for local testing to immediately authenticate without opening external browser windows.

---

## Build & Linting

```bash
# Type check and build web production bundle
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview
```

