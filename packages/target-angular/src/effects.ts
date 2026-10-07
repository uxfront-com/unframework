// Watchers, `watchEffect` and lifecycle hooks (plan §4.5, ADR-0048), as code for the class's
// constructor, `ngOnInit` and `ngOnDestroy`.
//
// - `watch(source, callback)` is an `effect()` created in `ngOnInit`, once the inputs are set, so
//   the source's value at creation is known, and typed, before any client code runs. Its source
//   goes through a `computed`, whose value changes only when it differs (`Object.is`), so the
//   effect runs again only when the source changed: never for a write that leaves the value as
//   it was, or for writes made away and back, and its `onCleanup` runs only before the next
//   callback and at destruction, as Vue's does. The callback runs `untracked`: it reads, it does
//   not subscribe. The effect's first run only records the source's value, or with `immediate`
//   runs the callback in the browser (an immediate callback is server-safe, UF2013, and every
//   target but Vue keeps it off the server).
// - `flush: "post"` makes it an `afterRenderEffect`, which runs after the view has rendered, in
//   the browser only.
// - `watchEffect(effect)` is an `afterRenderEffect` in the constructor: after each render in which
//   what it read changed, browser only, with Angular's own `onCleanup`.
// - `onMounted(callback)` is `afterNextRender(callback)`, in the browser once the view is in the
//   document; `onUnmounted(callback)` runs in `ngOnDestroy`, in the browser only (see
//   `EffectCode`).
import {
  codeKind,
  codeNames,
  functionText,
  NameScope,
  pascalCase,
  rewriteCode,
} from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type {
  Binding,
  FunctionCode,
  LifecycleItem,
  Parameter,
  WatchEffectItem,
  WatchItem,
  WatchSource,
} from "@unframework/ir";

import { bindingById, formOf, unreachable } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { classRead, tidied } from "./rules.ts";
import { bodyStatements, hasReturn } from "./statements.ts";

/** The names of the members and imports effects use, claimed by the emitter when needed. */
export interface EffectNames {
  /** The core function's local name (`effect`, `computed`, …). */
  core(name: string): string;
  /** `this.injector`, `this.platformId`, `this.appRef`: the member, claimed on first use. */
  member(name: "injector" | "platformId" | "appRef"): string;
  /** `isPlatformBrowser` from `@angular/common`. */
  common(name: string): string;
  /** A type from `@angular/core` (`EffectRef`), imported as a type. */
  type(name: string): string;
}

/**
 * What an effect adds to the class: its statements (for the constructor or `ngOnInit`), and, when
 * its cleanup may run code at destruction (an `onCleanup`, `onUnmounted`), the member that holds
 * it and the statements `ngOnDestroy` runs. Angular destroys a component's view effects, and runs
 * its `DestroyRef` callbacks, after the outputs it created first stopped emitting (NG0953), while
 * Vue stops a watcher and runs `onUnmounted` while the component still emits: `ngOnDestroy` runs
 * before both, so it destroys these effects and runs those hooks itself.
 */
export interface EffectCode {
  code?: string;
  /** The member that holds the effect: `private queryWatcher?: EffectRef;`. */
  ref?: { name: string; type: string; optional: boolean };
  destroy?: string;
}

/** A watcher's code for `ngOnInit`. */
export function watcherCode(
  item: WatchItem,
  plan: Plan,
  rules: RewriteRules,
  names: EffectNames,
): EffectCode {
  const { locals } = plan;
  const [valueParameter, previousParameter, cleanupParameter] = item.callback.parameters;
  const lines: string[] = [];
  // The value the effect watches: one signal, whose value changes only when it differs.
  let read: string;
  let hint: string;
  if (item.array) {
    const reads = item.sources.map((source) => sourceRead(source, plan, rules));
    const signal = locals.claim("currentValues");
    const equal = `(next, last) => next.every((value, index) => Object.is(value, last[index]))`;
    // One value the effect compares by identity: a new array only when a source changed, which
    // the callback gets as Vue hands it one, a mutable tuple (`satisfies` types the literal as
    // one: `[number, string]`, not `(number | string)[]`), and gets again as its previous value.
    const tuple = item.sources.map(() => "unknown").join(", ");
    lines.push(
      `const ${signal} = ${names.core("computed")}(() => [${reads.join(", ")}] satisfies [${tuple}], { equal: ${equal} });`,
    );
    read = `${signal}()`;
    hint = "values";
  } else {
    const [source] = item.sources;
    if (!source) throw new Error("A watcher has no source.");
    const watched = watchedSignal(source, plan);
    if (watched !== undefined) {
      // An input or a `computed` already changes only when its value differs.
      hint = watched.name;
      read = classRead(plan, watched);
    } else if (source.kind === "Ref") {
      // A state written away and back within one run changes its signal twice: a `computed`
      // over it changes only when its value differs.
      const state = bindingById(plan, source.binding);
      // A member that says `current` already (`currentStatus`, beside an output `status`) does not
      // say it twice: `currentStatus`, `lastStatus`, `statusWatcher`.
      hint = state.name.replace(/^current([A-Z])/, (_, first: string) => first.toLowerCase());
      const signal = locals.claim(`current${pascalCase(hint)}`);
      lines.push(`const ${signal} = ${names.core("computed")}(${arrow(classRead(plan, state))});`);
      read = `${signal}()`;
    } else {
      hint = valueParameter?.name ?? "value";
      const signal = locals.claim(`current${pascalCase(hint)}`);
      const getter = functionText(source.getter, plan.component, rules, "pure");
      lines.push(`const ${signal} = ${names.core("computed")}(${getter});`);
      read = `${signal}()`;
    }
  }
  // The previous value, when the callback reads it: an unused one would be a local no one reads.
  const reads = codeNames(item.callback.body.code, codeKind(item.callback.body, plan.component));
  const readsPrevious =
    previousParameter !== undefined &&
    (previousParameter.name === undefined
      ? (previousParameter.pattern?.names ?? []).some((name) => reads.has(name))
      : reads.has(previousParameter.name));
  // The last value the callback saw: a watcher skips its effect's first run by it, and an
  // immediate one, which runs then, keeps it only to give the next run its previous value.
  const last =
    !item.immediate || readsPrevious ? locals.claim(`last${pascalCase(hint)}`) : undefined;
  if (last !== undefined) lines.push(`let ${last} = ${read};`);
  const first = item.immediate && readsPrevious ? locals.claim("first") : undefined;
  if (first !== undefined) lines.push(`let ${first} = true;`);

  // The effect's own locals live in its function: they take none of the names its code reads,
  // `ngOnInit`'s locals and Angular's imports included.
  const inner = new NameScope([
    ...plan.reserved(item.callback),
    ...lines.flatMap((line) => /^(?:const|let) (\S+)/.exec(line)?.[1] ?? []),
  ]);
  // The value the effect reads: the callback's own, or for an array of sources whose parameter is
  // annotated, `current`, which the parameter takes (the last values keep the sources' tuple).
  const own = item.array && valueParameter?.type ? undefined : valueParameter?.name;
  const value = own ?? inner.claim(item.array ? "current" : "value");
  const body: string[] = [
    `const ${value}${own !== undefined && !item.array ? annotation(valueParameter) : ""} = ${read};`,
  ];
  if (!item.immediate) {
    // The effect's first run, and only it, finds the value it was created with.
    body.push(`if (Object.is(${value}, ${last})) return;`);
  }
  if (valueParameter && own === undefined) {
    body.push(`const ${parameterBinding(valueParameter)}${annotation(valueParameter)} = ${value};`);
  }
  if (previousParameter && readsPrevious) {
    // An immediate watcher's first previous value is `undefined`, or `[]` for an array of
    // sources, which Vue types as the tuple of each value or `undefined`.
    const previous =
      first === undefined
        ? last!
        : item.array
          ? `(${first} ? [] : ${last}) as [${item.sources.map((_, index) => `(typeof ${last})[${index}] | undefined`).join(", ")}]`
          : `${first} ? undefined : ${last}`;
    body.push(
      `const ${parameterBinding(previousParameter)}${annotation(previousParameter)} = ${defaulted(previousParameter, previous)};`,
    );
  }
  if (first !== undefined) body.push(`${first} = false;`);
  if (last !== undefined) body.push(`${last} = ${value};`);
  if (item.immediate) {
    // An immediate callback runs when the setup does, in the browser only (ADR-0048).
    body.push(
      `if (!${names.common("isPlatformBrowser")}(this.${names.member("platformId")})) return;`,
    );
  }
  body.push(`${names.core("untracked")}(${callbackFunction(item.callback, plan, rules)});`);
  const effect = names.core(item.post ? "afterRenderEffect" : "effect");
  const cleanup = cleanupParameter?.name ?? "";
  const ref = cleanupParameter
    ? {
        name: plan.members.claim(`${hint}Watcher`),
        type: names.type(item.post ? "AfterRenderRef" : "EffectRef"),
        optional: true,
      }
    : undefined;
  lines.push(
    `${ref ? `this.${ref.name} = ` : ""}${effect}((${cleanup}) => {\n${body.join("\n")}\n}, { injector: this.${names.member("injector")} });`,
  );
  return {
    code: lines.join("\n"),
    ...(ref ? { ref, destroy: `this.${ref.name}?.destroy();` } : {}),
  };
}

/**
 * The signal a source reads as it is, when it is one that changes only when its value differs:
 * a `derived` ref, or a getter that reads one input or one `derived` value whole (`() => title`).
 */
function watchedSignal(source: WatchSource, plan: Plan): Binding | undefined {
  const binding =
    source.kind === "Ref"
      ? bindingById(plan, source.binding)
      : source.getter.expression &&
          source.getter.body.refs.length === 1 &&
          source.getter.body.refs[0]!.kind === "Binding" &&
          source.getter.body.refs[0]!.span.start === source.getter.body.span.start &&
          source.getter.body.refs[0]!.span.end === source.getter.body.span.end
        ? bindingById(plan, source.getter.body.refs[0]!.binding)
        : undefined;
  if (binding === undefined) return undefined;
  const form = formOf(plan, binding);
  switch (form) {
    case "input":
    case "computed":
      return binding;
    case "signal":
    case "linked":
    case "once":
    case "value":
    case "query":
    case "method":
    case "arrow":
    case "field":
    case "loop":
    case "emit":
      return undefined;
    default:
      return unreachable(form);
  }
}

/** A watch source's value, read in the class. */
function sourceRead(source: WatchSource, plan: Plan, rules: RewriteRules): string {
  switch (source.kind) {
    case "Ref":
      return classRead(plan, bindingById(plan, source.binding));
    case "Getter": {
      // In an array of sources: a block body runs in place.
      const { getter } = source;
      const body = rewriteCode(getter.body, plan.component, rules, "pure");
      return getter.expression ? body : `(() => ${body})()`;
    }
    default:
      return unreachable(source);
  }
}

/** `() => code`, an object literal or a sequence in parentheses. */
export function arrow(code: string): string {
  return `() => ${/^\s*\{/.test(code) ? `(${code})` : code}`;
}

/**
 * The callback as `untracked`'s function: `() => …` with its block or its expression, or, for an
 * async callback, `async () => …`, whose promise nothing awaits, as Vue awaits none (its
 * continuation runs outside any reactive context on every target).
 */
function callbackFunction(fn: FunctionCode, plan: Plan, rules: RewriteRules): string {
  const head = fn.async ? "async () => " : "() => ";
  // A block body's `return`s give no value, which nothing reads (`noImplicitReturns`).
  if (!fn.expression) return `${head}{\n${bodyStatements(fn, plan, rules)}\n}`;
  const body = tidied(rewriteCode(fn.body, plan.component, rules, "client"), "expression");
  return `${head}${/^\s*\{/.test(body) ? `(${body})` : body}`;
}

/** A parameter's binding as written: its name, or its pattern. */
function parameterBinding(parameter: Parameter): string {
  return parameter.name ?? parameter.pattern?.code ?? "";
}

/** A parameter's type annotation as written, `: number`, or nothing. */
function annotation(parameter: Parameter | undefined): string {
  return parameter?.type ? `: ${parameter.type.code}` : "";
}

/** A value with a parameter's default applied, as calling with `undefined` applies it. */
function defaulted(parameter: Parameter, value: string): string {
  return parameter.default
    ? `${value} === undefined ? ${parameter.default.code} : ${value}`
    : value;
}

/** `watchEffect(effect)`'s code for the constructor. */
export function watchEffectCode(
  item: WatchEffectItem,
  plan: Plan,
  rules: RewriteRules,
  names: EffectNames,
): EffectCode {
  const [cleanup] = item.effect.parameters;
  const statements = bodyStatements(item.effect, plan, rules);
  // An async effect runs as a floating async function inside the effect: its reads before the
  // first `await` run in the effect's reactive context, so they are tracked, as Vue tracks them
  // (UF2015 keeps every reactive read there), and the effect's own value, which Angular hands to
  // a later phase, stays `undefined`.
  const body = item.effect.async ? `void (async () => {\n${statements}\n})();` : statements;
  const effect = `${names.core("afterRenderEffect")}((${cleanup?.name ?? ""}) => {\n${body}\n});`;
  if (!cleanup) return { code: effect };
  const ref = {
    name: plan.members.claim("renderEffect"),
    type: names.type("AfterRenderRef"),
    optional: false,
  };
  return { code: `this.${ref.name} = ${effect}`, ref, destroy: `this.${ref.name}.destroy();` };
}

/** A lifecycle hook's code: `onMounted` for the constructor, `onUnmounted` for `ngOnDestroy`. */
export function lifecycleCode(
  item: LifecycleItem,
  plan: Plan,
  rules: RewriteRules,
  names: EffectNames,
): EffectCode {
  const body = bodyStatements(item.callback, plan, rules);
  switch (item.hook) {
    case "mounted":
      return {
        code: `${names.core("afterNextRender")}(${item.callback.async ? "async " : ""}() => {\n${body}\n});`,
      };
    case "unmounted": {
      // In the browser only, as every target runs it (ADR-0048): the server destroys the
      // component too, once it has rendered. A body that returns runs in a function of its own,
      // so its `return` ends the hook, not `ngOnDestroy` and the hooks after it.
      const run = item.callback.async
        ? `void (async () => {\n${body}\n})();`
        : hasReturn(item.callback)
          ? `(() => {\n${body}\n})();`
          : body;
      return {
        destroy: `if (${names.common("isPlatformBrowser")}(this.${names.member("platformId")})) {\n${run}\n}`,
      };
    }
    default:
      return unreachable(item.hook);
  }
}
