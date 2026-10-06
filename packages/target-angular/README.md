# @unframework/target-angular

The Angular 22 target of the Unframework compiler: standalone, zoneless components with inline
templates, whose host element has `display: contents` (decision D6, ADR-0010).

## Output

One `<kebab-name>.ts` file per component (design §5.5):

- **Types.** The source's type declarations the props reach, copied as written and exported as
  the source exports them. An input is typed by its member's type, never by the props type, so
  a props type the source does not export is left out (it would be declared and never used).
- **Inputs.** Every prop is a public signal input, whether the template reads it or not (a
  prop is the component's API, and Angular reports a value for an undeclared input):
  `input.required<T>()` when required, `input<T>()` when optional, and
  `input<T, T | undefined>(default, { transform })` with a default, whose transform is
  `(value) => (value === undefined ? default : value)`: an explicit `undefined` takes the
  default, as JavaScript's destructuring does, and `null` stays a value.
- **Template.** One `@let label = this.label();` per input the template reads, then the markup
  of the Angular dialect (`@unframework/codegen`'s `angularDialect`): `{{ }}`, `@if`/`@for`,
  `[attr.x]` bindings, a static `class` beside one `[class]`, a static `style` beside
  `[style.x]`. The template reads props through those variables because Angular's type checker
  narrows a template variable as TypeScript narrows a local, but never a signal call, so every
  expression type-checks as it does in the source. A `track` expression may read only its item,
  `$index` and the component's members, so a prop a key reads is read there as `this.label()`.
- **Members.** Each allowed global the expressions read (`Math`, `String`) is a
  `protected readonly` member of the same name: a template sees only its component's members.
- **Names.** Angular's compiler accepts a signal input only in a class whose decorator is
  imported as `Component`, so a component named `Component` takes the class name `Component_1`
  and is exported under its own; `input` is imported under another name when a type takes it.

## Toolchain

Tests and tooling build, check and run the Angular output through three subpaths:

- `@unframework/target-angular/toolchain` (Node): the `toolchain` the harness drives.
  - `vite("browser" | "ssr", context)`: Angular's AOT compiler (ngtsc, strict templates) for
    the unframework plugin's virtual `X.uf.tsx.ts` modules, Analog with `jit: false`, and the
    Angular linker, over the pre-bundled framework in the browser and over the packages the SSR
    module graph inlines on the server, so no JIT compiler runs.
  - `frameworkCompile(files, context)` (L3) and `typecheck(files, context)` (L4): one ngtsc
    program over every file, reported per file.
  - `lint(files, context)` (L5, ADR-0042): oxlint's shared baseline over the TypeScript, and
    ESLint with angular-eslint over the file and its inline template.
- `@unframework/target-angular/toolchain/client`: the browser mount adapter (`createApplication`
  and `createComponent`, zoneless, settled with `whenStable`). `rerender(props)` sets each new
  prop with `setInput`, and `setInput(name, undefined)` for a prop the new props leave out,
  since Angular cannot unset an input (ADR-0043).
- `@unframework/target-angular/toolchain/server`: the SSR renderer (`renderApplication`), which
  returns the component's HTML only. It runs on the `ssr` Vite configuration, which links
  Angular's packages as they load.

Angular's compiler stack runs on TypeScript 6, while this repository runs TypeScript 7, so it is
never a dependency of this package. The toolchain loads `@angular/compiler-cli`, `@angular/build`,
`@analogjs/vite-plugin-angular` and TypeScript 6 from `context.toolchainDir`, which must have
them in its `node_modules` (in this repository, `tests/toolchains/angular`), together with a
`tsconfig.json` for the type check.
