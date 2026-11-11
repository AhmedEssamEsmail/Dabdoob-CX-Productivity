import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const boundary = String.raw`(?:^|[^\w-])`;
const end = String.raw`(?:[^\w-]|$)`;
// `cx-sr` is the canonical visually-hidden class (cx-kit.css :root .cx-sr);
// only its `-` suffixed variants and the legacy `sr-only` vocabulary warn.
const warnLosers = String.raw`${boundary}(?:cx-sr-[\w-]+|sr-only(?:-[\w-]+)?)${end}`;
// dq-editor, dq-days and dq-holform stay exempt per the keep-documented verdict in results/dq-map.md.
const errorLosers = String.raw`${boundary}(?:empty(?:-[\w-]+)?|card(?:-[\w-]+)?|pill(?:-[\w-]+)?|note(?:-[\w-]+)?|agechip(?:-[\w-]+)?|tabs(?:-[\w-]+)?|brand-mark(?:-[\w-]+)?|nav-link--off(?:-[\w-]+)?|nav-ext(?:-[\w-]+)?|cx-toast(?:-[\w-]+)?|tag(?:-[\w-]+)?|tbl(?:-[\w-]+)?|seg(?:-[\w-]+)?|page-sub(?:-[\w-]+)?|pw-dialog(?:-[\w-]+)?|dq-(?!(?:editor|days|holform)(?:-[\w-]+|__[\w-]+)?${end})[\w-]+)${end}`;
const warnRe = new RegExp(warnLosers);
const errorRe = new RegExp(errorLosers);
const loserRule = (re, skip, message) => ({
  meta: { type: "problem", schema: [], messages: { loser: message } },
  create(context) {
    const keys = context.sourceCode.visitorKeys;
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      const value = node.type === "Literal" ? node.value : node.type === "TemplateElement" ? node.value.raw : null;
      if (typeof value === "string" && re.test(value) && !(skip && skip.test(value))) {
        context.report({ node, messageId: "loser" });
      }
      for (const key of keys[node.type] ?? []) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach(visit);
        else visit(child);
      }
    };
    return {
      JSXAttribute(node) {
        if (node.name?.name === "className") visit(node.value);
      },
    };
  },
});
const featureOf = (file) => /features[\\/](cx-[\w-]+)[\\/]/.exec(file)?.[1];
const sourceFeature = (source) =>
  /(?:^|\/)(cx-[\w-]+)(?:\/|$)/.exec(String(source).replace(/\\/g, "/"))?.[1];
const boundaryRule = {
  meta: { type: "problem", schema: [], messages: { boundary: "Feature components must not import another cx-* feature area; route through @/features/shared." } },
  create(context) {
    const fileFeature = featureOf(context.filename ?? context.getFilename());
    const check = (node) => {
      const source = node.source?.value;
      if (typeof source !== "string") return;
      const target = sourceFeature(source);
      if (fileFeature && target && target !== fileFeature) {
        context.report({ node, messageId: "boundary" });
      }
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};
const localDefNames = new Set(["fetchJson", "useSe"]);
const localDefRule = {
  meta: { type: "problem", schema: [], messages: { def: "Hand-rolled fetchJson/useSe; import the canonical helper from @/features/shared/lib." } },
  create(context) {
    return {
      FunctionDeclaration(node) {
        if (node.id && localDefNames.has(node.id.name)) context.report({ node, messageId: "def" });
      },
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && localDefNames.has(node.id.name)) context.report({ node, messageId: "def" });
      },
    };
  },
};
const local = {
  rules: {
    "loser-classnames-error": loserRule(errorRe, null, "Deleted loser class vocabulary; use the canonical cx-* class."),
    "loser-classnames-warn": loserRule(warnRe, errorRe, "Loser class vocabulary is still migrating; prefer the canonical cx-* class."),
    "feature-boundary": boundaryRule,
    "local-defs": localDefRule,
  },
};

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
    files: ["src/**/*.{ts,tsx}"],
    plugins: { local },
    rules: {
      "local/loser-classnames-error": "error",
      "local/loser-classnames-warn": "warn",
    },
  },
  {
    // S12-12 (ST-H1): feature components must not import another cx-* area
    // (warn: cx-people/components/shared.tsx re-exports cx-queue — migration backlog).
    files: ["src/features/cx-*/components/**/*.{ts,tsx}"],
    plugins: { local },
    rules: { "local/feature-boundary": "warn" },
  },
  {
    // S12-12 (ST-H1): no hand-rolled fetchJson/useSe outside shared/lib
    // (warn: 7 existing per-feature defs — fetchJson in cx-hub/cx-people/cx-queue
    // shared.tsx, useSe in cx-people/cx-queue/cx-quality/cx-productivity).
    files: ["src/features/cx-*/**/*.{ts,tsx}"],
    plugins: { local },
    rules: { "local/local-defs": "warn" },
  },
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
