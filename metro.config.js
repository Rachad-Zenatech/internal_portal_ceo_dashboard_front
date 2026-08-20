// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Setup alias resolving for @/*
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@": path.resolve(__dirname, "src"),
};

// Ensure .native extensions are prioritized
const standardExts = config.resolver.sourceExts || ["tsx", "ts", "jsx", "js", "json"];
config.resolver.sourceExts = [
  "native.tsx",
  "native.ts",
  "native.jsx",
  "native.js",
  ...standardExts.filter((ext) => !ext.startsWith("native.")),
];

// Set Metro port to 8090
config.server = {
  ...config.server,
  port: 8090,
};

module.exports = config;
