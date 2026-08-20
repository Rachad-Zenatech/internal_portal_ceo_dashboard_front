import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_BASE_URL;

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: "0.0.0.0",
      port: 5175,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
        "/ai": {
          target,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: [
        {
          find: /^react-native\/Libraries\/Utilities\/codegenNativeComponent/,
          replacement: path.resolve(__dirname, "src/lib/codegenShim.ts"),
        },
        { find: /^react-native$/, replacement: "react-native-web" },
      ],
      extensions: [
        ".web.tsx",
        ".web.ts",
        ".web.jsx",
        ".web.js",
        ".tsx",
        ".ts",
        ".jsx",
        ".js",
      ],
    },
  };
});
