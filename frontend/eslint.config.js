import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRecommended from "eslint-plugin-react/configs/recommended.js";

const reactHooksRules = reactHooks.configs.recommended.rules;

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", ".vite/**"],
  },
  js.configs.recommended,
  reactRecommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        WebSocket: "readonly",
        crypto: "readonly",
        JSX: "readonly",
        React: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-empty-pattern": "off",
      eqeqeq: ["warn", "always"],
      curly: ["error", "all"],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "quote-props": ["error", "as-needed"],
      "comma-dangle": ["error", { arrays: "always-multiline", objects: "always-multiline", imports: "always-multiline", exports: "always-multiline", functions: "never" }],
      semi: ["error", "always"],
      "no-dupe-keys": "error",
      "no-duplicate-imports": "off",
      "react/no-unescaped-entities": "off",
      "no-irregular-whitespace": "error",
      "no-trailing-spaces": "error",
      "no-unreachable": "error",
      "prefer-template": "error",
      "arrow-spacing": ["error", { before: true, "after": true }],
      "block-spacing": ["error", "always"],
      "brace-style": ["error", "1tbs"],
      "comma-spacing": ["error", { before: false, after: true }],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "keyword-spacing": ["error", { before: true, after: true }],
      "space-before-blocks": "error",
      "switch-colon-spacing": ["error", { after: true }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": ["error", { minimumDescriptionLength: 10 }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      ...reactHooksRules,
      "react-hooks/rules-of-hooks": "warn",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts", "tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-console": "off",
    },
  },
];
