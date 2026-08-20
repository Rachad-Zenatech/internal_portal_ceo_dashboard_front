# CEO Dashboard - Frontend (Web & Mobile)

Cross-platform frontend portal for the **ZenaTech CEO Dashboard**, supporting both a modern web application (React + Vite + Tailwind CSS + shadcn UI) and a native mobile application (Expo + React Native).

---

## Architecture Overview

The frontend codebase is architected with platform-specific extensions (`.tsx` for Web and `.native.tsx` for Mobile / React Native):

* **Web Portal (Vite)**: Runs as a single-page application at `http://localhost:5175`.
* **Mobile App (Expo / React Native)**: Runs via Metro Bundler on port `8090` targeting iOS & Android devices/emulators.

### Project Structure

```txt
frontend/internal_portal_ceo_dashboard_front/
├── index.html                 # Web HTML entry point
├── index.js                   # Mobile Expo entry point
├── app.json                   # Expo configuration & app scheme
├── vite.config.ts             # Vite configuration (port 5175, proxy to backend)
├── scripts/
│   └── start-android.js       # Automated Android emulator & ADB reverse startup script
├── src/
│   ├── App.tsx                # Web root navigation & layout
│   ├── App.native.tsx         # Mobile root navigation (NativeStack)
│   ├── components/
│   │   ├── native/            # Universal & native UI primitives (Cards, Buttons, Badges)
│   │   └── ui/                # Web shadcn UI components
│   ├── lib/
│   │   ├── AuthContext.tsx    # Universal authentication context & permissions state
│   │   ├── env.ts             # Universal environment config reader
│   │   └── storage.ts         # Unified storage (localStorage for Web / AsyncStorage for Native)
│   ├── pages/
│   │   ├── Dashboard.tsx        # Web CEO Dashboard
│   │   ├── Dashboard.native.tsx # Mobile CEO Dashboard
│   │   ├── Login.tsx            # Web Microsoft SSO Login
│   │   ├── Login.native.tsx     # Mobile Microsoft SSO & Direct Dev Login
│   │   └── PendingAccess.native.tsx
│   └── services/
│       └── apiClient.ts       # Central Axios client (routes requests to API base URL)
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

### Option A: Run Web Application

Start the Vite development server on `http://localhost:5175`:

```bash
npm run dev
```

### Option B: Run Mobile Application (Android Emulator)

Ensure your Android SDK is installed and configured. Then run the automated starter script:

```bash
npm run android
```

This script will automatically:
1. Detect or launch the **Pixel 7** Android emulator.
2. Configure **ADB reverse port forwarding**:
   * `8090 -> 8090` (Metro Bundler)
   * `8005 -> 8005` (FastAPI Backend)
   * `5175 -> 5175` (Vite SSO Redirect server)
3. Launch Expo Metro on port `8090` and connect the Android emulator.

### Option C: Run Expo Metro Directly

```bash
npm start
# (Runs expo start --host lan --port 8090)
```

* In the terminal, press **`a`** to open Android emulator.
* In the terminal, press **`w`** to open web mode.
* In the terminal, press **`r`** to reload the bundle.

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
