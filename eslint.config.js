import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // .claude/** holds agent-managed git worktrees with their own (and possibly
  // stale) source trees — linting them from the root project surfaces thousands
  // of errors that aren't on main. Same intent as the supabase/mobile excludes:
  // each tree gets linted by its own pipeline.
  { ignores: ["dist", "supabase/**", "mobile/**", "design_handoff_burs_rn/**", ".claude/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // N5: web `src/` is being deleted post-launch, but until it goes we
      // don't want fresh `any` creeping into the deprecated tree. Tests +
      // scripts override this below.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // Test files + scripts: relax strict typing rules. `any` is unavoidable
  // when stubbing supabase chains or shelling out via Node.
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "src/test/**",
      "scripts/**",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
);
