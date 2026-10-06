// The Angular toolchain (DESIGN §4.1): how tests build, check and run the Angular output.
// Angular's compiler stack is loaded from `context.toolchainDir` (see ./tools.ts), so this
// package depends only on the Angular runtime its adapters import.
import type { Toolchain } from "@unframework/codegen";
import {
  lintWithEslint,
  lintWithOxlint,
  mergeLintResults,
} from "@unframework/codegen/toolchain-node";

import { frameworkCompile, typecheck } from "./check.ts";
import { viteConfig } from "./vite.ts";

/** The Angular 22 toolchain: ngtsc AOT with strict templates for L3, L4 and every project. */
export const toolchain: Toolchain = {
  name: "angular",
  vite: viteConfig,
  client: "@unframework/target-angular/toolchain/client",
  server: "@unframework/target-angular/toolchain/server",
  frameworkCompile,
  typecheck,
  // L5 (ADR-0042): oxlint's shared baseline over the TypeScript, ESLint with angular-eslint over
  // the file and its inline template.
  lint: async (files, context) =>
    mergeLintResults(
      await Promise.all([lintWithOxlint(files, context), lintWithEslint(files, context)]),
    ),
};

export default toolchain;
