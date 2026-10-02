// oxlint-disable-next-line typescript/triple-slash-reference -- a script (ambient `*.css`) cannot be imported.
/// <reference path="./client.d.ts" />
/**
 * The JSX types for `"jsx": "preserve"` and `"jsxImportSource": "unframework"` (ADR-0017).
 *
 * TypeScript reads the `JSX` namespace from this module, even under `preserve`. There is no runtime:
 * the compiler lowers every JSX expression per target, and nothing imports this module's values.
 *
 * Each intrinsic element is the upstream's attributes (vendored from @vue/runtime-dom, reached only
 * through ./jsx-upstream.ts) minus the keys unframework owns, plus `OwnedElementAttributes`, Vue's
 * event options and the `v-model` spellings. Components get layer 1 of plan §5.6 through
 * `LibraryManagedAttributes`: no false errors on legitimate consumers, payloads left to the compiler.
 * The probes in ../probes pin exactly what this catches.
 */
import type {
  ClassValue,
  StyleValue,
  UpstreamEvents,
  UpstreamHTMLAttributes,
  UpstreamIntrinsicElements,
} from "./jsx-upstream.ts";

// Unique symbols are per declaration: these are declared once, here, and only re-exported.
declare const elementBrand: unique symbol;
declare const templateRefTarget: unique symbol;
declare const typedComponent: unique symbol;

/**
 * The brand the content mapper (layer 3 of plan §5.6, M5) puts on a component's virtual type once it
 * has declared the component's events, models and slots exactly. A branded component loses the open
 * layer-1 signatures, so misspelt events and models become errors too.
 */
export interface TypedComponent {
  readonly [typedComponent]: true;
}

/** One child of a JSX element. Slot functions and `.map` callbacks return these. */
export type Child = JSX.Element | string | number | bigint | boolean | null | undefined;
/** What a JSX element accepts as children: a child, or (nested) arrays of children. */
export type Children = Child | readonly Children[];

/**
 * The consumer side of named and scoped slots: `<Card>{{ default: () => …, title: () => … }}</Card>`.
 * Slot props are `any` under stock tsgo (layer 1); the content mapper types them.
 */
export interface SlotObject {
  readonly [slot: string]: ((props: any) => Children) | undefined;
}

/**
 * What `useTemplateRef<T>()` returns. It lives here rather than in ./index.ts because it shares the
 * phantom `templateRefTarget` key with `RefAttribute`.
 */
export interface TemplateRef<T> {
  /** `null` until the element is mounted. */
  readonly value: T | null;
  /** Phantom, type-only: never exists at runtime. */
  readonly [templateRefTarget]: (element: T) => void;
}

/**
 * What `ref={…}` accepts on an element whose DOM type is `E`. Contravariant on purpose: a
 * `TemplateRef<HTMLElement>` may hold an `<input>`, a `TemplateRef<HTMLButtonElement>` may not.
 */
export interface RefAttribute<E> {
  readonly [templateRefTarget]: (element: E) => void;
}

/** The DOM element type of a tag, for `ref`. */
export type DomElementFor<K> = K extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[K]
  : K extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[K]
    : Element;

/** Vue's event-option suffixes (plan §4.3): `onClickCapture`, `onClickOnce`, `onClickPassive`. */
export type EventOptionSuffix = "Capture" | "Once" | "Passive";
/** The upstream has no event-option handlers, so they are derived from its event map. */
export type EventOptionHandlers = {
  [K in keyof UpstreamEvents as `${K}${EventOptionSuffix}`]?: (event: UpstreamEvents[K]) => void;
};

/**
 * `v-model` and Vue JSX's modifier spellings, on the form controls that support them. The modifiers
 * are written with `_` because JSX attribute names cannot contain `.`.
 */
export interface VModelAttributes {
  "v-model"?: unknown;
  "v-model_trim"?: unknown;
  "v-model_lazy"?: unknown;
  "v-model_number"?: unknown;
}

/** Keys unframework defines itself; removed from the upstream before `OwnedElementAttributes` is added. */
export type OwnedKeys = "key" | "ref" | "children";

export interface OwnedElementAttributes<E> {
  key?: PropertyKey | undefined;
  ref?: RefAttribute<E> | undefined;
  children?: Children;
}

/** HTML void elements: children are an error. */
export type VoidElementTag =
  | "area"
  | "base"
  | "br"
  | "col"
  | "embed"
  | "hr"
  | "img"
  | "input"
  | "link"
  | "meta"
  | "source"
  | "track"
  | "wbr";

type FormControlTag = "input" | "textarea" | "select";

export type ElementAttributes<K extends keyof UpstreamIntrinsicElements> = Omit<
  UpstreamIntrinsicElements[K],
  OwnedKeys
> &
  OwnedElementAttributes<DomElementFor<K>> &
  EventOptionHandlers &
  (K extends VoidElementTag ? { children?: never } : unknown) &
  (K extends FormControlTag ? VModelAttributes : unknown);

export type UfIntrinsicElements = {
  [K in keyof UpstreamIntrinsicElements]: ElementAttributes<K>;
};

/**
 * `<component is={href ? "a" : "button"}>` over a statically known set of tags or components
 * (plan §4.3). The upstream's own `is?: string` is omitted: it would widen `is` to any string.
 */
export interface DynamicComponentAttributes
  extends Omit<UpstreamHTMLAttributes, OwnedKeys | "is">, EventOptionHandlers {
  is: keyof UpstreamIntrinsicElements | ((props: any) => JSX.Element | null);
  key?: PropertyKey | undefined;
  ref?: RefAttribute<any> | undefined;
  children?: Children | SlotObject;
  [attribute: string]: unknown;
}

/** Custom elements (`<my-element>`): typed global attributes, and any other attribute. */
export interface CustomElementAttributes
  extends Omit<UpstreamHTMLAttributes, OwnedKeys>, EventOptionHandlers {
  key?: PropertyKey | undefined;
  ref?: RefAttribute<HTMLElement> | undefined;
  children?: Children;
  [attribute: string]: unknown;
}

/**
 * Layer 1 of plan §5.6: what every component accepts besides its signature props, so that legitimate
 * consumer code never fails under stock tsgo. Payloads, model types and slot props are deliberately
 * `any` or `unknown` here: the compiler (layer 2) and the content mapper (layer 3) check them.
 */
export interface ComponentAttributes {
  key?: PropertyKey | undefined;
  /** A component ref. Its exposed API (`defineExpose`) is typed by the content mapper. */
  ref?: RefAttribute<any> | undefined;
  /** Fallthrough onto the component's root element. */
  class?: ClassValue | undefined;
  style?: StyleValue | undefined;
  /** The default slot (JSX children) or a slot object. */
  children?: Children | SlotObject;
  /**
   * `v-model={x.value}` and `v-model:open={x.value}`, for documentation and completions only:
   * TypeScript never checks an undeclared hyphenated JSX attribute, nor matches one against an index
   * signature. The content mapper declares each model as an explicit `"v-model:open"?: T` prop,
   * which is checked.
   */
  "v-model"?: unknown;
  [model: `v-model:${string}`]: unknown;
  /** `onChange={…}`: an event declared with `defineEmits`, or a listener that falls through. */
  [event: `on${Capitalize<string>}`]: ((...payload: any[]) => unknown) | undefined;
}

export declare namespace JSX {
  /**
   * The result of a JSX expression. Opaque: a template fragment the compiler lowers per target (a
   * VNode on Vue, a ReactNode on React, markup on Svelte, Angular and Astro), never a value the
   * source may inspect.
   */
  interface Element {
    readonly [elementBrand]: "unframework.element";
  }
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicElements extends UfIntrinsicElements {
    component: DynamicComponentAttributes;
    [customElement: `${string}-${string}`]: CustomElementAttributes;
  }
  /** Only what every value-based element accepts. The open layer-1 surface is in `LibraryManagedAttributes`. */
  interface IntrinsicAttributes {
    key?: PropertyKey | undefined;
  }
  /**
   * TypeScript checks a component's attributes against `LibraryManagedAttributes<typeof C, P> &
   * IntrinsicAttributes`. A stock component gets the open layer-1 surface; one the content mapper has
   * branded gets its declared props plus `ref`, `class` and `style` only. (`IntrinsicAttributes`
   * could not do this: it is intersected into every component, branded or not.)
   */
  type LibraryManagedAttributes<C, P> = C extends TypedComponent
    ? P & Pick<ComponentAttributes, "ref" | "class" | "style">
    : P & ComponentAttributes;
}
