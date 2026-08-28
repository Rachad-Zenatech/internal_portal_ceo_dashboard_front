import { execSync } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

function getAdbPath() {
  const isWindows = process.platform === "win32";

  // Check ANDROID_HOME or ANDROID_SDK_ROOT first
  const envSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (envSdk && fs.existsSync(envSdk)) {
    const ext = isWindows ? ".exe" : "";
    const adbPath = path.join(envSdk, "platform-tools", `adb${ext}`);
    if (fs.existsSync(adbPath)) return adbPath;
  }

  // Windows
  if (isWindows) {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(
      localAppData,
      "Android",
      "Sdk",
      "platform-tools",
      "adb.exe"
    );
  }

  // macOS
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Android", "sdk", "platform-tools", "adb");
  }

  // WSL or Linux environment
  let sdkBase = "";
  if (fs.existsSync("/mnt/c/Users")) {
    try {
      const users = fs.readdirSync("/mnt/c/Users");
      const foundUser = users.find(
        (u) =>
          u !== "Public" &&
          u !== "Default" &&
          u !== "All Users" &&
          fs.existsSync(`/mnt/c/Users/${u}/AppData/Local/Android/Sdk`)
      );
      if (foundUser) {
        sdkBase = `/mnt/c/Users/${foundUser}/AppData/Local/Android/Sdk`;
      }
    } catch {}
  }

  if (!sdkBase) {
    sdkBase = path.join(os.homedir(), "Android", "Sdk");
  }

  const ext = sdkBase.startsWith("/mnt/c") ? ".exe" : "";
  return path.join(sdkBase, "platform-tools", `adb${ext}`);
}

async function main() {
  const adbPath = getAdbPath();
  console.log("🔄 Re-syncing ADB reverse ports & reloading Android app...");

  try {
    execSync(`"${adbPath}" reverse tcp:8090 tcp:8090`, { stdio: "ignore" });
    execSync(`"${adbPath}" reverse tcp:8005 tcp:8005`, { stdio: "ignore" });
    execSync(`"${adbPath}" reverse tcp:5175 tcp:5175`, { stdio: "ignore" });
    console.log("🔗 Reverse ports configured (8090, 8005, 5175).");
  } catch (err) {
    console.log("⚠️ Could not reverse ports:", err.message);
  }

  try {
    execSync(
      `"${adbPath}" shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8090" host.exp.exponent`,
      { stdio: "inherit" }
    );
    console.log("✅ Android emulator reloaded successfully with latest bundle!");
  } catch (err) {
    console.log("❌ Failed to trigger reload on emulator:", err.message);
  }
}

main();
