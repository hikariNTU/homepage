// module.exports = {
//   root: true,
//   env: { browser: true, es2020: true },
//   extends: [
//     "eslint:recommended",
//     "plugin:@typescript-eslint/recommended",
//     "plugin:react-hooks/recommended",
//     "plugin:prettier/recommended",
//   ],
//   ignorePatterns: ["dist", ".eslintrc.cjs"],
//   parser: "@typescript-eslint/parser",
//   plugins: ["react-refresh"],
//   rules: {
//     "react-refresh/only-export-components": [
//       "warn",
//       { allowConstantExport: true },
//     ],
//   },
// };

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  {
    ignores: ["dist", ".eslintrc.cjs"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  prettierRecommended,
);