// A `.uf.ts` module's composable as its own Angular module, `use-toggle.ts` (ADR-0069): a function
// that needs an injection context, as Angular's own `inject*` functions do, and returns read-only
// signals and plain functions. A component calls it from a field initialiser, its constructor or
// `ngOnInit` (./plan.ts, `CallPlacement`).
//
// Its setup is a function body in source order, each binding a local:
// - a state is `signal(initial)`, read `on()` and written through `set`, and returned as
//   `on.asReadonly()`, since a caller never writes it (UF2036);
// - a derived value is `computed(getter)`;
// - a constant, a `let` and a function are as written; a value argument is read as written, a
//   getter called and a callback called as the source does;
// - `watch` is an `effect()`, which, like a component's watcher (./effects.ts), runs its callback
//   only when its source's value differs. Its first run records the value: the composable may
//   run before the caller's inputs are set, which a getter argument may read (NG0950). `flush:
//   "post"` makes it an `afterRenderEffect`;
// - `watchEffect` is an `afterRenderEffect`, and `onMounted` is `afterNextRender`;
// - `onUnmounted` runs when the caller is destroyed, through its `DestroyRef`, in the browser
//   only (ADR-0048).
import {
  addTypeImports,
  codeKind,
  codeNames,
  componentTypes,
  functionBodyText,
  functionText,
  ImportSet,
  js,
  kebabCase,
  NameScope,
  pascalCase,
  printProgram,
  rewriteCode,
  sourceNames,
  typeDeclarationCode,
  typeNames,
  typeSpecifier,
  writtenValue,
} from "@unframework.dev/codegen";
import type { EmitContext, OutputFile, RewriteRules } from "@unframework.dev/codegen";
import type {
  Binding,
  FunctionCode,
  SetupItem,
  TypeText,
  UfComponent,
  UfComposable,
  WatchItem,
} from "@unframework.dev/ir";

import { annotation, arrow, defaulted, parameterBinding } from "./effects.ts";
import { moduleReads } from "./modules.ts";
import { assertedSetup, narrowedWhole } from "./narrowing.ts";
import { ANGULAR_IMPORTS, unreachable } from "./plan.ts";

/**
 * A composable as the setup owner the codegen helpers read: its bindings, its setup and the
 * types it declares, with no props and nothing to render.
 */
function setupOwner(composable: UfComposable): UfComponent {
  return {
    name: composable.name,
    span: composable.span,
    ...(composable.typeParameters ? { typeParameters: composable.typeParameters } : {}),
    props: [],
    types: composable.types,
    bindings: composable.bindings,
    setup: composable.setup,
    render: { kind: "Fragment", children: [], span: composable.span },
  };
}

/** What a composable's code needs as it prints. */
interface ComposableContext {
  owner: UfComponent;
  imports: ImportSet;
  rules: RewriteRules;
  /** The function's own locals: none its code reads or declares, nor Angular's imports. */
  locals: Pick<NameScope, "claim">;
  /** The names the function's code reads or declares, and those it claimed so far. */
  taken: string[];
  /** `isPlatformBrowser(inject(PLATFORM_ID))`'s local, declared once where code needs it. */
  browser(): string;
}

/**
 * `use-toggle.ts`: `export function useToggle(initial: boolean) { …; return { on:
 * on.asReadonly(), toggle }; }`, its setup in source order, its parameters as written.
 */
export function emitComposable(composable: UfComposable, context: EmitContext): OutputFile[] {
  const { module } = context;
  const owner = assertedSetup(setupOwner(composable));
  const source = sourceNames(owner, module);
  const imports = new ImportSet(new NameScope([...source]));
  const core = (name: string) => imports.add("@angular/core", name);
  const kinds = new Map(owner.bindings.map((binding) => [binding.id, binding.kind]));
  const head: string[] = [];
  let nextTick: string | undefined;
  let browser: string | undefined;
  const taken = [...source, ...ANGULAR_IMPORTS, "Object"];
  const scope = new NameScope(taken);
  // Each local it claims is one an effect's own locals leave alone too.
  const locals = {
    claim: (name: string) => {
      const local = scope.claim(name);
      taken.push(local);
      return local;
    },
  };
  const rules: RewriteRules = {
    binding: (reference, binding, written) => {
      const kind = kinds.get(binding.id);
      // A ref is read through its signal's call, and passed whole as the signal.
      if ((kind === "state" || kind === "derived") && written.endsWith(".value")) {
        return `${binding.name}()${narrowedWhole(reference) ? "!" : ""}`;
      }
      return binding.name;
    },
    write: (write, binding, parts) =>
      kinds.get(binding.id) === "state"
        ? `${binding.name}.set(${writtenValue(write, parts)})`
        : undefined,
    // Vue's `nextTick` (ADR-0048): the caller renders the pending change in a microtask.
    api: () => {
      if (nextTick === undefined) {
        nextTick = locals.claim("nextTick");
        const appRef = locals.claim("appRef");
        head.push(
          `const ${appRef} = ${core("inject")}(${core("ApplicationRef")});`,
          `async function ${nextTick}(): Promise<void> {\n  await Promise.resolve();\n  ${appRef}.tick();\n}`,
        );
      }
      return nextTick;
    },
  };
  const code: ComposableContext = {
    owner,
    imports,
    rules,
    locals,
    taken,
    browser: () => {
      if (browser === undefined) {
        browser = locals.claim("browser");
        const check = imports.add("@angular/common", "isPlatformBrowser");
        head.push(`const ${browser} = ${check}(${core("inject")}(${core("PLATFORM_ID")}));`);
      }
      return browser;
    },
  };
  const statements = owner.setup.map((item) => itemCode(item, code));
  const returned = composable.returns.map(({ name, binding }) =>
    kinds.get(binding) === "state" ? `${name}: ${name}.asReadonly()` : name,
  );
  const parameters = composable.parameters.map(
    ({ name, optional, type }) => `${name}${optional ? "?" : ""}: ${type.code}`,
  );
  const typeParameters = composable.typeParameters?.length
    ? `<${composable.typeParameters
        .map(
          ({ name, constraint, default: fallback }) =>
            `${name}${constraint ? ` extends ${constraint.code}` : ""}${fallback ? ` = ${fallback.code}` : ""}`,
        )
        .join(", ")}>`
    : "";
  const body = [...head, ...statements, `return { ${returned.join(", ")} };`].join("\n\n");
  // What it reads of its module, and the types it and its parameters name (ADR-0067, ADR-0070).
  const reads = moduleReads(owner.bindings, module, imports, kebabCase);
  addTypeImports(owner, module, imports, kebabCase);
  addParameterTypeImports(composable, imports, module);
  const declared = componentTypes(owner, module);
  const names = new Set(declared.map(({ name }) => name));
  const types = [...declared, ...reads.types.filter(({ name }) => !names.has(name))].toSorted(
    (a, b) => a.span.start - b.span.start,
  );
  const contents = [
    printProgram(js.program(imports.toDeclarations())).trim(),
    ...types.map(typeDeclarationCode),
    ...(reads.constants.length ? [reads.constants.join("\n")] : []),
    `export function ${composable.name}${typeParameters}(${parameters.join(", ")}) {\n${body}\n}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return [{ path: `${kebabCase(composable.name)}.ts`, contents: `${contents}\n` }];
}

/** The types its parameters and type parameters name, imported as the source imports them. */
function addParameterTypeImports(
  composable: UfComposable,
  imports: ImportSet,
  module: EmitContext["module"],
): void {
  const texts: TypeText[] = [
    ...composable.parameters.map(({ type }) => type),
    ...(composable.typeParameters ?? []).flatMap(({ constraint, default: fallback }) =>
      [constraint, fallback].filter((type): type is TypeText => type !== undefined),
    ),
  ];
  const read = new Set(texts.flatMap((type) => [...typeNames(type)]));
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!read.has(name.local)) continue;
      imports.add(typeSpecifier(entry.specifier, module, kebabCase), name.imported, {
        type: true,
        local: name.local,
        exact: true,
      });
    }
  }
}

/** A setup item's statement. */
function itemCode(item: SetupItem, context: ComposableContext): string {
  const { owner, rules, imports } = context;
  const core = (name: string) => imports.add("@angular/core", name);
  const name = (id: string) => bindingOf(owner, id).name;
  const pure = (code: Parameters<typeof rewriteCode>[0]) => rewriteCode(code, owner, rules, "pure");
  switch (item.kind) {
    case "State": {
      const type = item.type
        ? `<${item.initial ? item.type.code : `${item.type.code} | undefined`}>`
        : "";
      return `const ${name(item.binding)} = ${core("signal")}${type}(${item.initial ? pure(item.initial) : "undefined"});`;
    }
    case "Derived": {
      const type = item.type ? `<${item.type.code}>` : "";
      return `const ${name(item.binding)} = ${core("computed")}${type}(${functionText(item.getter, owner, rules, "pure")});`;
    }
    case "Const":
      return `const ${name(item.binding)}${item.type ? `: ${item.type.code}` : ""} = ${pure(item.value)};`;
    case "Variable":
      return `let ${name(item.binding)}${item.type ? `: ${item.type.code}` : ""}${item.initial ? ` = ${pure(item.initial)}` : ""};`;
    case "Function":
      return functionText(item.function, owner, rules, "client", { name: name(item.binding) });
    case "Watch":
      return watcherCode(item, context);
    case "WatchEffect": {
      const [cleanup] = item.effect.parameters;
      const statements = hookBody(item.effect, context);
      const body = item.effect.async ? `void (async () => {\n${statements}\n})();` : statements;
      return `${core("afterRenderEffect")}((${cleanup?.name ?? ""}) => {\n${body}\n});`;
    }
    case "Lifecycle": {
      const body = hookBody(item.callback, context);
      switch (item.hook) {
        case "mounted":
          return `${core("afterNextRender")}(${item.callback.async ? "async " : ""}() => {\n${body}\n});`;
        case "unmounted":
          return `if (${context.browser()}) {\n${core("inject")}(${core("DestroyRef")}).onDestroy(${item.callback.async ? "async " : ""}() => {\n${body}\n});\n}`;
        default:
          return unreachable(item.hook);
      }
    }
    // UF2035 rejects these in a composable (ADR-0069).
    case "TemplateRef":
    case "Id":
    case "Model":
    case "Provide":
    case "Inject":
    case "Use":
      throw new Error(`A composable holds a \`${item.kind}\` item, which the analyser rejects.`);
    default:
      return unreachable(item);
  }
}

/** A hook's or an effect's body as statements, its value dropped. */
function hookBody(fn: FunctionCode, context: ComposableContext): string {
  return functionBodyText(fn, context.owner, context.rules, "client", { discard: true });
}

/**
 * `watch(source, callback)` as an `effect()` over a `computed` of the source, whose value changes
 * only when it differs. Its first run records the value; an immediate watcher's runs the callback
 * too, in the browser only (ADR-0048).
 */
function watcherCode(item: WatchItem, context: ComposableContext): string {
  const { owner, rules, imports, locals } = context;
  const core = (name: string) => imports.add("@angular/core", name);
  const [valueParameter, previousParameter, cleanupParameter] = item.callback.parameters;
  const read = (binding: Binding) => `${binding.name}()`;
  const sources = item.sources.map((source) => {
    switch (source.kind) {
      case "Ref":
        return {
          hint: bindingOf(owner, source.binding).name,
          value: read(bindingOf(owner, source.binding)),
        };
      case "Getter": {
        const body = rewriteCode(source.getter.body, owner, rules, "pure");
        return {
          hint: valueParameter?.name ?? "value",
          value: source.getter.expression ? body : `(() => ${body})()`,
        };
      }
      default:
        return unreachable(source);
    }
  });
  const lines: string[] = [];
  const hint = item.array ? "values" : sources[0]!.hint;
  const signal = locals.claim(`current${pascalCase(hint)}`);
  if (item.array) {
    const tuple = sources.map(() => "unknown").join(", ");
    const equal = `(next, last) => next.every((value, index) => Object.is(value, last[index]))`;
    lines.push(
      `const ${signal} = ${core("computed")}(() => [${sources.map(({ value }) => value).join(", ")}] satisfies [${tuple}], { equal: ${equal} });`,
    );
  } else {
    lines.push(`const ${signal} = ${core("computed")}(${arrow(sources[0]!.value)});`);
  }
  const reads = codeNames(item.callback.body.code, codeKind(item.callback.body, owner));
  const readsPrevious =
    previousParameter !== undefined &&
    (previousParameter.name === undefined
      ? (previousParameter.pattern?.names ?? []).some((each) => reads.has(each))
      : reads.has(previousParameter.name));
  // The value the callback last saw, for its previous one, and whether the effect ran before.
  const last = readsPrevious ? locals.claim(`last${pascalCase(hint)}`) : undefined;
  const watching = !item.immediate || readsPrevious ? locals.claim("watching") : undefined;
  if (last !== undefined) lines.push(`let ${last}!: ReturnType<typeof ${signal}>;`);
  if (watching !== undefined) lines.push(`let ${watching} = false;`);
  const inner = new NameScope([...context.taken, ...callbackNames(item.callback, owner)]);
  const value = inner.claim(item.array ? "current" : "value");
  // The read subscribes the effect; the callback and the previous value may not need its value.
  const body = [valueParameter || last ? `const ${value} = ${signal}();` : `${signal}();`];
  if (!item.immediate) {
    const record = last === undefined ? "" : `${last} = ${value};\n`;
    body.push(`if (!${watching}) {\n${watching} = true;\n${record}return;\n}`);
  }
  if (valueParameter) {
    body.push(`const ${parameterBinding(valueParameter)}${annotation(valueParameter)} = ${value};`);
  }
  if (previousParameter && readsPrevious) {
    const previous = item.immediate
      ? item.array
        ? `(${watching} ? ${last} : []) as [${sources.map((_, index) => `(typeof ${last})[${index}] | undefined`).join(", ")}]`
        : `${watching} ? ${last} : undefined`
      : last!;
    body.push(
      `const ${parameterBinding(previousParameter)}${annotation(previousParameter)} = ${defaulted(previousParameter, previous)};`,
    );
  }
  if (item.immediate && watching !== undefined) body.push(`${watching} = true;`);
  if (last !== undefined) body.push(`${last} = ${value};`);
  if (item.immediate) body.push(`if (!${context.browser()}) return;`);
  const callback = item.callback.expression
    ? `${item.callback.async ? "async " : ""}() => ${arrowBody(rewriteCode(item.callback.body, owner, rules, "client"))}`
    : `${item.callback.async ? "async " : ""}() => {\n${functionBodyText(item.callback, owner, rules, "client")}\n}`;
  body.push(`${core("untracked")}(${callback});`);
  const effect = core(item.post ? "afterRenderEffect" : "effect");
  lines.push(`${effect}((${cleanupParameter?.name ?? ""}) => {\n${body.join("\n")}\n});`);
  return lines.join("\n");
}

/** An arrow's expression body, an object literal in parentheses. */
function arrowBody(code: string): string {
  return /^\s*\{/.test(code) ? `(${code})` : code;
}

/** The names a callback declares and reads, which the effect's own locals leave alone. */
function callbackNames(fn: FunctionCode, owner: UfComponent): string[] {
  return [
    ...codeNames(fn.body.code, codeKind(fn.body, owner)),
    ...fn.parameters.flatMap((parameter) =>
      parameter.name === undefined ? (parameter.pattern?.names ?? []) : [parameter.name],
    ),
  ];
}

/** The binding a composable declares under `id`. */
function bindingOf(owner: UfComponent, id: string): Binding {
  const binding = owner.bindings.find((each) => each.id === id);
  if (!binding) throw new Error(`Composable ${owner.name} declares no binding ${id}.`);
  return binding;
}
