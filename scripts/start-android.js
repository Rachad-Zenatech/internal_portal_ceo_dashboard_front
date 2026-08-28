import { spawn, execSync } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

function getAndroidSdkPaths() {
  const isWindows = process.platform === "win32";

  // Check ANDROID_HOME or ANDROID_SDK_ROOT environment variables first
  const envSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (envSdk && fs.existsSync(envSdk)) {
    const ext = isWindows ? ".exe" : "";
    const adbPath = path.join(envSdk, "platform-tools", `adb${ext}`);
    const emulatorPath = path.join(envSdk, "emulator", `emulator${ext}`);
    if (fs.existsSync(adbPath)) {
      return { adbPath, emulatorPath, isWindows };
    }
  }

  // Windows
  if (isWindows) {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const adbPath = path.join(
      localAppData,
      "Android",
      "Sdk",
      "platform-tools",
      "adb.exe"
    );
    const emulatorPath = path.join(
      localAppData,
      "Android",
      "Sdk",
      "emulator",
      "emulator.exe"
    );
    return { adbPath, emulatorPath, isWindows: true };
  }

  // macOS
  if (process.platform === "darwin") {
    const sdkBase = path.join(os.homedir(), "Library", "Android", "sdk");
    const adbPath = path.join(sdkBase, "platform-tools", "adb");
    const emulatorPath = path.join(sdkBase, "emulator", "emulator");
    return { adbPath, emulatorPath, isWindows: false };
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
  const adbPath = path.join(sdkBase, "platform-tools", `adb${ext}`);
  const emulatorPath = path.join(sdkBase, "emulator", `emulator${ext}`);

  // Create an adb shim directory in ./node_modules/.bin if in WSL
  try {
    const binDir = path.resolve("./node_modules/.bin");
    if (fs.existsSync(binDir) && ext === ".exe") {
      const adbShim = path.join(binDir, "adb");
      fs.writeFileSync(adbShim, `#!/bin/sh\n"${adbPath}" "$@"\n`, { mode: 0o755 });
    }
  } catch {}

  return { adbPath, emulatorPath, isWindows: false };
}

function getAvailableAvd(emulatorPath) {
  try {
    const avdOutput = execSync(`"${emulatorPath}" -list-avds`, { encoding: "utf-8" });
    const avds = avdOutput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (avds.length > 0) {
      // Prioritize Pixel_7 if present, otherwise pick the first available AVD
      if (avds.includes("Pixel_7")) return "Pixel_7";
      return avds[0];
    }
  } catch {}
  return "Pixel_7";
}

async function main() {
  const { adbPath, emulatorPath, isWindows } = getAndroidSdkPaths();

  console.log("🚀 Checking for connected Android devices...");
  let devicesOutput = "";
  try {
    devicesOutput = execSync(`"${adbPath}" devices`, { encoding: "utf-8" });
  } catch {
    try {
      execSync(`"${adbPath}" start-server`, { stdio: "ignore" });
      devicesOutput = execSync(`"${adbPath}" devices`, { encoding: "utf-8" });
    } catch {
      devicesOutput = "";
    }
  }

  const hasDevice = devicesOutput
    .split("\n")
    .map((l) => l.trim())
    .some((l) => l.endsWith("device") && !l.startsWith("List"));

  if (!hasDevice) {
    const targetAvd = getAvailableAvd(emulatorPath);
    console.log(
      `📱 Launching ${targetAvd} emulator (DirectX ANGLE / Vulkan disabled for crash protection)...`
    );
    try {
      spawn(
        emulatorPath,
        [
          "-avd",
          targetAvd,
          "-gpu",
          "angle_indirect",
          "-feature",
          "-Vulkan",
        ],
        {
          detached: true,
          stdio: "ignore",
          shell: false,
        }
      ).unref();

      console.log(`⏳ Waiting for ${targetAvd} to attach...`);
      execSync(`"${adbPath}" wait-for-device`, {
        stdio: "inherit",
        timeout: 45000,
      });
      console.log(`✅ ${targetAvd} connected!`);
    } catch {
      console.log("⚠️ Emulator starting in background, continuing to Expo...");
    }
  } else {
    console.log("✅ Android device/emulator is already running and connected.");
  }

  // Configure ADB reverse forwarding
  try {
    execSync(`"${adbPath}" reverse tcp:8090 tcp:8090`, { stdio: "ignore" });
    execSync(`"${adbPath}" reverse tcp:8005 tcp:8005`, { stdio: "ignore" });
    execSync(`"${adbPath}" reverse tcp:5175 tcp:5175`, { stdio: "ignore" });
    console.log(
      "🔗 Reverse port forwarding configured (8090 -> 8090, 8005 -> 8005, 5175 -> 5175)."
    );
  } catch {}

  // Environment variables for Expo
  const adbDir = path.dirname(adbPath);
  const currentPath = process.env.PATH || "";
  const env = {
    ...process.env,
    PATH: `${adbDir}${path.delimiter}${path.resolve("./node_modules/.bin")}${path.delimiter}${currentPath}`,
  };

  // Launch Expo
  console.log("⚡ Starting Expo Metro on port 8090 with fresh cache...\n");
  const expoProcess = spawn(
    "npx",
    ["expo", "start", "--android", "--clear", "--port", "8090"],
    {
      stdio: "inherit",
      shell: true,
      env,
    }
  );

  expoProcess.on("exit", (code) => {
    process.exit(code || 0);
  });
}

main();
