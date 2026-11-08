import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone Node CJS scripts (not part of the app bundle) and agent scratch:
    ".devin/**",
    "migration/**",
    "scripts/**/*.js",
    "specs/**/*.js",
    "verify-db.js",
  ]),
  {
    files: ["src/features/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/cx-*"],
              message:
                "features/shared must not import feature modules (composition exceptions: jobs/env.ts, jobs/mirrors.ts)",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/features/shared/jobs/env.ts",
      "src/features/shared/jobs/mirrors.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
