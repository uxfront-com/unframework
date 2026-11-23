import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { capabilities, setModifierManager } from "@ember/modifier";
import { renderSettled } from "@ember/renderer";
import type { ModifierLike } from "@glint/template";

export interface SearchResultsEvents {
  onReady?: (text: string) => void;
  onRendered?: (count: number) => void;
  onShown?: (text: string) => void;
}

export interface SearchResultsSignature {
  Args: { style?: unknown } & SearchResultsEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class SearchResults extends Component<SearchResultsSignature> {
  addOne = async () => {
    this.count += 1;
    await renderSettled();
    this.args.onShown?.(this.total?.textContent ?? "");
  };

  @tracked status = "Loading";

  @tracked query = "";

  @tracked results: string[] = [];

  @tracked count = 0;

  @tracked doubled = 0;

  @tracked banner: HTMLParagraphElement | null = null;

  @tracked list: HTMLUListElement | null = null;

  @tracked total: HTMLOutputElement | null = null;

  readonly watcher1 = new Watcher(
    this,
    () => this.query,
    (value) => {
      this.results = value === "" ? [] : [value, `${value} docs`];
    },
  );

  readonly watcher2 = new Watcher(
    this,
    () => this.query,
    () => {
      this.args.onRendered?.(this.list?.childElementCount ?? -1);
    },
    { post: true },
  );

  readonly watcher3 = new Watcher(
    this,
    () => this.count,
    (value) => {
      this.doubled = value * 2;
    },
  );

  #mounted = false;

  /** Called at the template's end: the hooks run once the component has rendered. */
  onMounted = (): undefined => {
    if (!this.#mounted) {
      this.#mounted = true;
      afterRender(this, async () => {
        this.status = "Ready";
        await renderSettled();
        this.args.onReady?.(this.banner?.textContent ?? "");
      });
    }
    return undefined;
  };

  listener1 = (event: HTMLElementEventMap["input"]) =>
    (this.query = (event.currentTarget as HTMLInputElement).value);

  <template>{{(this.watcher1.flush)}}{{(this.watcher2.flush)}}{{(this.watcher3.flush)}}<section
      class="search-results"
      aria-label="Search"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p {{templateRef this "banner"}}>{{this.status}}</p><label>Query<input
      name="query"
      {{on "input" this.listener1}}
    ></label><ul
      {{templateRef this "list"}}
      aria-label="Results"
    >{{#each this.results key="@identity" as |result|}}<li>{{result}}</li>{{/each}}</ul><output
      {{templateRef this "total"}}
    >{{this.doubled}}</output><button type="button" {{on "click" this.addOne}}>Add one</button></section>{{(this.onMounted)}}</template>
}

/**
 * Vue's `watch`: the template calls `flush` before anything else, so it sees a change of a
 * source in the render that follows it, and the callback runs right after that render, or once
 * the render settles for a `post` watcher. A cleanup the callback registers runs before its
 * next run, and when the component is destroyed.
 */
class Watcher<T> {
  readonly #owner: object;
  readonly #source: () => T;
  readonly #callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown;
  readonly #options: { array?: boolean; immediate?: boolean; post?: boolean };
  #started = false;
  #value: T | undefined;
  #cleanup: (() => void) | undefined;

  constructor(
    owner: object,
    source: () => T,
    callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
    options: { array?: boolean; immediate?: boolean; post?: boolean } = {},
  ) {
    this.#owner = owner;
    this.#source = source;
    this.#callback = callback;
    this.#options = options;
    registerDestructor(owner, () => this.#cleanup?.());
  }

  readonly flush = (): undefined => {
    const value = this.#source();
    const started = this.#started;
    // On the server a watcher runs at most its immediate first run, as Vue's does.
    if (import.meta.env.SSR && started) return undefined;
    if (started && this.#same(value, this.#value as T)) return undefined;
    const previous = (started ? this.#value : this.#options.array ? [] : undefined) as T;
    this.#started = true;
    this.#value = value;
    if (!started && !this.#options.immediate) return undefined;
    const run = () => {
      const cleanup = this.#cleanup;
      this.#cleanup = undefined;
      cleanup?.();
      void this.#callback(value, previous, (each) => {
        this.#cleanup = each;
      });
    };
    // The render that calls `flush` has read what the callback may write, so the callback
    // runs right after it, or once the render settles for a `post` watcher.
    const later = () => {
      if (!isDestroying(this.#owner)) run();
    };
    if (this.#options.post) void renderSettled().then(later);
    else {
      callbacks.pending += 1;
      queueMicrotask(() => {
        callbacks.pending -= 1;
        later();
      });
    }
    return undefined;
  };

  #same(value: T, previous: T): boolean {
    if (!this.#options.array) return Object.is(value, previous);
    const values = value as unknown[];
    const previousValues = previous as unknown[];
    return values.every((each, index) => Object.is(each, previousValues[index]));
  }
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}

/** How many watchers' callbacks are to run once the current render is done. */
const callbacks = { pending: 0 };

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}

/** A modifier that sets a member of its component to its element while the element is rendered. */
const templateRef = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: () => ({}),
    installModifier(
      _state: object,
      element: Element,
      { positional }: { positional: readonly unknown[] },
    ) {
      Reflect.set(positional[0] as object, positional[1] as string, element);
    },
    updateModifier() {},
    destroyModifier(_state: object, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, null);
    },
  }),
  {},
) as unknown as ModifierLike<{
  Element: Element;
  Args: { Positional: [owner: object, name: string] };
}>;
