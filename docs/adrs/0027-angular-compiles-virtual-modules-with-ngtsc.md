# ADR-0027: Angular compiles the unplugin's virtual modules with our ngtsc step, in the browser and on the server

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §8.2 (the bundler plugin), §5.7, §6 (Angular), §7.3, R5, R12; amends ADR-0021 and ADR-0024

## Context

Plan §8.2 says the unplugin compiles a `.uf.tsx` import to the target's native source under a
virtual id, and "the host framework's own plugin finishes the job", which for Angular is Analog.
ADR-0021 (spike 4) showed that this does not hold for Angular: Analog compiles only the files of
its TypeScript program on disk, so a module that exists only through `load` reaches the browser
with a raw `@Component` decorator. The spike answered with `ngtscVirtual`, a Vite plugin that
compiles each virtual module with `NgtscProgram` over an in-memory host. ADR-0024 (the SSR spike)
went another way for `ssr:angular`: it resolved the committed golden file on disk, listed in
Analog's tsconfig, and imported `@angular/compiler` so Node could JIT-link Angular's own
partially compiled packages. It left open whether SSR should use `ngtscVirtual` too.

## Decision

- **One path for every Angular project.** Browser and SSR projects both run `ngtscVirtual`
  (`@unframework/target-angular/toolchain`): real ngtsc AOT with strict templates over the
  unplugin's `X.uf.tsx.ts` ids, reading each module's source through the unplugin's
  `api.getCompiled(id)`. Strict-template diagnostics fail the transform.
- **Analog stays in the chain with an empty program** (`files: []`, `jit: false`), as it would sit
  in an Analog app. It finds no decorators left and passes the modules through.
- **Nothing is JIT-compiled, as in production.** Browser projects pre-bundle `@angular/*` and link
  them in the dependency optimizer (`angularLinker`). SSR projects inline `@angular/*`
  (`ssr.noExternal`) and link them in a Vite transform with `@angular/build`'s linker
  (`angularSsrLinker`), so SSR no longer imports `@angular/compiler`.
- **The compiler matches the runtime.** The toolchain refuses to start when the project's
  `@angular/core` and the toolchain's `@angular/compiler-cli` are different releases, because AOT
  output calls the instructions of its own compiler's release.
- **The heavy tools stay in `tests/toolchains/angular`** with TypeScript 6 (ADR-0022), loaded
  lazily from the toolchain directory; the target package depends on none of them.
- **For applications (M6)**, the unplugin's Angular path ships the same ngtsc step ahead of Analog.
  Plan §8.2 now says so.

## Consequences

**Positive:**

- The browser and the server run the same AOT code, compiled from the same virtual module the golden
  guard checks against `__output__/angular`. ADR-0024's dependency on the golden file being in
  Analog's program is gone.
- SSR loads no JIT compiler, so a component that only works under JIT fails, as it would in
  production.

**Negative:**

- `ngtscVirtual` and the two linkers are our code on Angular's compiler API. Angular releases can
  break them, which is why the toolchain pins and checks the compiler release.
- `ngtscVirtual` compiles one program per module, reusing the previous one. ADR-0021's suggestion of
  one program per project for about 250 cases is not implemented yet; M0's corpus does not need it.
- A parent component compiled before its child has been loaded cannot see the child's generated
  source (composition, M3): `getCompiled` only knows modules `load` has already served.

## Alternatives considered

- **ADR-0024's golden-file path for SSR.** It bypasses the unplugin and the compiler, so SSR would
  test the committed file rather than what an application imports, and it needs every golden in
  Analog's program.
- **Analog's `fastCompile`.** Its single-pass compiler is not ngtsc: ADR-0021 recorded output that
  diverges (change detection, `ɵɵelementStart` instead of `ɵɵdomElementStart`).
- **JIT in SSR.** Not the production path, and it hides AOT-only failures.

## Evidence

- `ssr:angular` and `browser:angular` are green on both basics cases at every live layer, from the
  virtual ids; the golden guard proves the browser and the server ran the reviewed code.
- The L4-type-error and L3-mismatched-closing-tag canaries fail the Angular toolchain projects, and
  the L6 and L7 canaries fail `ssr:angular` and `browser:angular`.
