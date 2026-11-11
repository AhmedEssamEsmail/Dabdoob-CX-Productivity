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
// P3-C34 (PLAN C3 + C4): Phase-1 class guards. All four ship "warn" and flip
// to "error" in C34-02 once `npx eslint src` reports 0 warnings from them
// (burn-in = Phase-1 fixes merged). Caveat: eslint sees no .css — B6/B5
// inside stylesheets stay a Phase-1 sweep concern, not a rule.
const stringRule = (re, message) => ({
  meta: { type: "problem", schema: [], messages: { hit: message } },
  create(context) {
    const keys = context.sourceCode.visitorKeys;
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      const value = node.type === "Literal" ? node.value : node.type === "TemplateElement" ? node.value.raw : null;
      if (typeof value === "string" && re.test(value)) {
        context.report({ node, messageId: "hit" });
      }
      for (const key of keys[node.type] ?? []) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach(visit);
        else visit(child);
      }
    };
    return {
      Program(node) {
        visit(node);
      },
    };
  },
});
const styleLiteralRule = (re, message) => ({
  meta: { type: "problem", schema: [], messages: { hit: message } },
  create(context) {
    const keys = context.sourceCode.visitorKeys;
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      const value = node.type === "Literal" ? node.value : node.type === "TemplateElement" ? node.value.raw : null;
      if (typeof value === "string" && re.test(value)) {
        context.report({ node, messageId: "hit" });
      }
      for (const key of keys[node.type] ?? []) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach(visit);
        else visit(child);
      }
    };
    return {
      JSXAttribute(node) {
        if (node.name?.name === "style") visit(node.value);
      },
    };
  },
});
const rawControlNames = new Set(["input", "select", "textarea", "button"]);
const rawControlsRule = {
  meta: { type: "problem", schema: [], messages: { raw: "Raw <input>/<select>/<textarea>/<button>; use the shared primitive from @/features/shared/components/ui (B3/A3)." } },
  create(context) {
    const marked = context.sourceCode.getAllComments()
      .filter((c) => c.value.includes("intentionally raw"));
    return {
      JSXOpeningElement(node) {
        const name = node.name?.name;
        if (typeof name !== "string" || !rawControlNames.has(name)) return;
        const line = node.loc.start.line;
        if (marked.some((c) => c.loc.end.line <= line && line - c.loc.end.line <= 4)) return;
        context.report({ node, messageId: "raw" });
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
    "no-transition-all": stringRule(/transition\s*:\s*all/i, "transition: all banned; list explicit properties (B6)."),
    "no-hex-classname": loserRule(/#(?:[0-9a-fA-F]{3,8})\b/, null, "Hex literal in className; use a semantic token class, not an arbitrary [#...] value (B5)."),
    "no-raw-controls": rawControlsRule,
    "no-style-token-literals": styleLiteralRule(/#(?:[0-9a-fA-F]{3,8})\b|\b\d+px\b|rgba?\(/i, "Hex/px/rgba literal in a style prop; use a token class or CSS var (C4/B4)."),
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
  {
    // P3-C34 (B6/B5-lite/B3-lite, PLAN C3): warn backlog — burn in at warn;
    // C34-02 flips to error once `npx eslint src` shows 0 of these warnings.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { local },
    rules: {
      "local/no-transition-all": "warn",
      "local/no-hex-classname": "warn",
      "local/no-raw-controls": "warn",
    },
  },
  {
    // B3-lite: raw controls under shared/components/ui ARE the primitives — exempt.
    files: ["src/features/shared/components/ui/**"],
    rules: { "local/no-raw-controls": "off" },
  },
  {
    // P3-C34 (C4/B4): style-prop hex/px/rgba literals — warn backlog.
    files: ["src/features/**/*.{ts,tsx}"],
    plugins: { local },
    rules: { "local/no-style-token-literals": "warn" },
  },
]);

export default eslintConfig;
