// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Setup alias resolving for @/*
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@": path.resolve(__dirname, "src"),
};

// Set Metro port to 8090
config.server = {
  ...config.server,
  port: 8090,
};

module.exports = config;
