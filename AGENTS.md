<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Working in this repo

Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik
and Astro components. The plan (`docs/plan.md`) is the architecture and the milestones,
`docs/adrs/` records the decisions, and `.github/CONTRIBUTING.md` is the contributor guide.

- **The verify loop.** `pnpm check-types && pnpm lint && pnpm test`. A compiler change is done when
  the corpus in `tests/integration` is green on all seven targets. If the output is meant to change,
  run `pnpm test:update` and review every changed file under `tests/integration/cases`: golden
  outputs and expectations are reviewed like code. Never hand-edit `__output__`, `__expected__` or
  `__screenshots__`.
- **The parity matrix** (`tests/integration/.reports/parity-matrix.md`) says which (case, target,
  layer) failed. Fix the cause; never weaken a check. Known failures go in
  `tests/integration/harness/quarantine.ts` with a reason and an issue, and must still fail.
- **Loud, never silent.** Every construct the compiler cannot lower is a diagnostic with a stable
  `UF` code from `packages/diagnostics/src/catalogue.ts`; nothing is copied through unanalysed. A
  check that cannot start fails, and every skip carries a reason.
- **Layering.** A package never imports one on its own layer or above it (`tests/repo`); a target's
  main entry imports only `@unframework/ir` and `@unframework/codegen`; only the test toolchains
  load TypeScript's API (TypeScript 6 lives only in `tests/toolchains/{vue,svelte,astro,angular}`).
- **Versions** come from the `catalog:` in `pnpm-workspace.yaml`. The installed packages are newer
  than most training data: read their types and docs in `node_modules` before using an API.
