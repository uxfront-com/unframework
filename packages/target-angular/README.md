# @unframework/target-angular

The Angular 22 target of the Unframework compiler: standalone, zoneless components with inline
templates, whose host element has `display: contents` (decision D6).

## Toolchain

Tests and tooling build, check and run the Angular output through three subpaths:

- `@unframework/target-angular/toolchain` (Node): the `toolchain` the harness drives.
  - `vite("browser" | "ssr", context)`: Angular's AOT compiler (ngtsc, strict templates) for
    the unframework plugin's virtual `X.uf.tsx.ts` modules, Analog with `jit: false`, and the
    Angular linker, over the pre-bundled framework in the browser and over the packages the SSR
    module graph inlines on the server, so no JIT compiler runs.
  - `frameworkCompile(files, context)` (L3) and `typecheck(files, context)` (L4): one ngtsc
    program over every file, reported per file.
- `@unframework/target-angular/toolchain/client`: the browser mount adapter (`createApplication`
  and `createComponent`, zoneless, settled with `whenStable`).
- `@unframework/target-angular/toolchain/server`: the SSR renderer (`renderApplication`), which
  returns the component's HTML only. It runs on the `ssr` Vite configuration, which links
  Angular's packages as they load.

Angular's compiler stack runs on TypeScript 6, while this repository runs TypeScript 7, so it is
never a dependency of this package. The toolchain loads `@angular/compiler-cli`, `@angular/build`,
`@analogjs/vite-plugin-angular` and TypeScript 6 from `context.toolchainDir`, which must have
them in its `node_modules` (in this repository, `tests/toolchains/angular`), together with a
`tsconfig.json` for the type check.
