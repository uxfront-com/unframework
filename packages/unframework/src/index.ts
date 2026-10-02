/**
 * The unframework authoring API (plan §4.2, ADR-0006): types, plus inert stubs.
 *
 * The compiler recognises these by binding, not by name, and erases them: no `unframework` import
 * survives into any output. Calling one at runtime means the file was not compiled, so every stub
 * throws instead of pretending to work.
 *
 * The signatures follow Vue 3.5, narrowed to the canonical forms (ADR-0007): a named `defineModel`,
 * named-tuple `defineEmits`, getter-only `computed`, a key-less `useTemplateRef`, typed injection
 * keys. Type parameters of the macros default to `never`, so an un-parameterised macro is unusable.
 */
import type { JSX, TemplateRef } from "./jsx-runtime.ts";

export type {
  Child,
  Children,
  ComponentAttributes,
  JSX,
  RefAttribute,
  SlotObject,
  TemplateRef,
  TypedComponent,
} from "./jsx-runtime.ts";
export type { ClassValue, CSSProperties, StyleValue } from "./jsx-upstream.ts";

declare const refBrand: unique symbol;
declare const injectionKeyType: unique symbol;

/** A reactive reference. Writes replace the value whole: `list.value = [...list.value, x]` (ADR-0008). */
export interface Ref<T> {
  value: T;
  readonly [refBrand]: true;
}

/** A read-only derived value, from `computed`. */
export interface ComputedRef<T> {
  readonly value: T;
  readonly [refBrand]: true;
}

/** The ref `defineModel` returns: writable, and controllable whether the consumer binds it or not. */
export interface ModelRef<T> extends Ref<T> {}

/**
 * A typed key for `provide` and `inject`: `export const TabsKey: InjectionKey<Tabs> = Symbol("Tabs")`.
 * The phantom member keeps `InjectionKey<A>` and `InjectionKey<B>` apart; it never exists at runtime.
 */
export type InjectionKey<T> = symbol & { readonly [injectionKeyType]?: T };

/** What `watch` can observe: a ref, a computed or a getter (never a plain value). */
export type WatchSource<T> = Ref<T> | ComputedRef<T> | (() => T);
/** Registers a cleanup that runs before the next callback and when the watcher stops. */
export type OnCleanup = (cleanup: () => void) => void;
export type WatchStopHandle = () => void;
export interface WatchOptions<Immediate extends boolean = boolean> {
  /** Run once at setup; the first `previous` is then `undefined`. */
  immediate?: Immediate;
  /** `"post"` to read the DOM after it has updated. */
  flush?: "pre" | "post" | "sync";
  once?: boolean;
}
export interface WatchEffectOptions {
  flush?: "pre" | "post" | "sync";
}
type WatchValues<S extends readonly WatchSource<unknown>[]> = {
  [K in keyof S]: S[K] extends WatchSource<infer V> ? V : never;
};

/** `defineEmits<{ change: [value: number] }>()`: each event name maps to a named-tuple payload. */
export type EmitsMap = Record<string, readonly unknown[]>;
/** The `emit` function. It returns `void`: listeners may run asynchronously on some targets (Qwik). */
export type EmitFn<E extends EmitsMap> = <K extends keyof E & string>(
  event: K,
  ...payload: E[K]
) => void;

/** `defineSlots<{ default?(): Element; item?(props: { item: Item }): Element }>()`. */
export type SlotsMap = Record<string, ((...props: any[]) => unknown) | undefined>;

/** The static options `defineOptions` accepts. */
export interface ComponentOptions {
  /** `false` stops undeclared attributes falling through to the root element. */
  inheritAttrs?: boolean;
}

function compileTimeOnly(api: string): never {
  throw new Error(
    `unframework: \`${api}\` is compile-time only. This module was not compiled by unframework ` +
      "(is the .uf.tsx file going through the unframework bundler plugin?).",
  );
}

// State and derivation

/** Reactive state: `const count = ref(0)`, written with `count.value = …`, `++` or `+=`. */
export function ref<T>(value: T): Ref<T>;
export function ref<T = undefined>(): Ref<T | undefined>;
export function ref(_value?: unknown): Ref<unknown> {
  return compileTimeOnly("ref");
}

/** A read-only derived value: `const doubled = computed(() => count.value * 2)`. */
export function computed<T>(_getter: () => T): ComputedRef<T> {
  return compileTimeOnly("computed");
}

// Effects (client-only: they never run during SSR)

/** Runs `callback` after the source changes, with the new and previous values. */
export function watch<T, Immediate extends boolean = false>(
  source: WatchSource<T>,
  callback: (
    value: T,
    previous: Immediate extends true ? T | undefined : T,
    onCleanup: OnCleanup,
  ) => void,
  options?: WatchOptions<Immediate>,
): WatchStopHandle;
/** Runs `callback` after any of the sources changes, with the tuples of new and previous values. */
export function watch<
  const S extends readonly WatchSource<unknown>[],
  Immediate extends boolean = false,
>(
  sources: S,
  callback: (
    values: WatchValues<S>,
    previous: Immediate extends true ? Partial<WatchValues<S>> : WatchValues<S>,
    onCleanup: OnCleanup,
  ) => void,
  options?: WatchOptions<Immediate>,
): WatchStopHandle;
export function watch(_source: unknown, _callback: unknown, _options?: unknown): WatchStopHandle {
  return compileTimeOnly("watch");
}

/** Runs `effect` now and again whenever a value it read changes. */
export function watchEffect(
  _effect: (onCleanup: OnCleanup) => void,
  _options?: WatchEffectOptions,
): WatchStopHandle {
  return compileTimeOnly("watchEffect");
}

// Lifecycle (client-only)

/** Runs after the component's DOM is in the document. */
export function onMounted(_hook: () => void): void {
  compileTimeOnly("onMounted");
}

/** Runs when the component is removed: clear timers and listeners here. */
export function onUnmounted(_hook: () => void): void {
  compileTimeOnly("onUnmounted");
}

/** Resolves after pending DOM updates have been applied. */
export function nextTick(): Promise<void>;
export function nextTick<R>(callback: () => R): Promise<Awaited<R>>;
export function nextTick(_callback?: () => unknown): Promise<unknown> {
  return compileTimeOnly("nextTick");
}

// Macros: the component's public API, besides the props in its signature

/** Declares events: `const emit = defineEmits<{ change: [value: number] }>()`; consumers write `onChange`. */
export function defineEmits<E extends EmitsMap = never>(): EmitFn<E> {
  return compileTimeOnly("defineEmits");
}

/**
 * Declares a two-way bound value: `const open = defineModel<boolean>("open", { default: false })`;
 * consumers write `v-model:open={…}`. The name is required, `"value"` for the default model.
 */
export function defineModel<T>(name: string, options: { required: true; default?: T }): ModelRef<T>;
export function defineModel<T>(
  name: string,
  options: { default: T; required?: boolean },
): ModelRef<T>;
export function defineModel<T = unknown>(
  name: string,
  options?: { required?: false },
): ModelRef<T | undefined>;
export function defineModel(_name: string, _options?: unknown): ModelRef<unknown> {
  return compileTimeOnly("defineModel");
}

/** Declares slots, rendered with `{slots.title?.()}`; presence is `slots.title`. */
export function defineSlots<S extends SlotsMap = never>(): Readonly<S> {
  return compileTimeOnly("defineSlots");
}

/** The API a component ref exposes to its parent: `defineExpose({ focus })`. */
export function defineExpose(_exposed: Record<string, unknown>): void {
  compileTimeOnly("defineExpose");
}

/** Static component options, as an object literal: `defineOptions({ inheritAttrs: false })`. */
export function defineOptions(_options: ComponentOptions): void {
  compileTimeOnly("defineOptions");
}

// Template refs, ids and context

/** `const input = useTemplateRef<HTMLInputElement>()` with `<input ref={input} />`: no string key. */
export function useTemplateRef<T = unknown>(): TemplateRef<T> {
  return compileTimeOnly("useTemplateRef");
}

/** An id that is unique per instance and stable between server and client renders. */
export function useId(): string {
  return compileTimeOnly("useId");
}

/** Makes `value` available to descendants that `inject(key)`. Pass refs to keep it reactive. */
export function provide<T>(_key: InjectionKey<T>, _value: T): void {
  compileTimeOnly("provide");
}

/** Reads what an ancestor provided; `undefined` when none did, unless a fallback is given. */
export function inject<T>(key: InjectionKey<T>): T | undefined;
export function inject<T>(key: InjectionKey<T>, fallback: T): T;
export function inject(_key: InjectionKey<unknown>, _fallback?: unknown): unknown {
  return compileTimeOnly("inject");
}

/** `JSX.Element` without a second import, for slot types: `defineSlots<{ default?(): Element }>()`. */
export type Element = JSX.Element;
