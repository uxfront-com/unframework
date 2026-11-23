import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

export interface ReadingListProps {
  shelves: string[];
}

export interface ReadingListEvents {
  onRequested?: (url: string) => void;
  onCancelled?: (query: string) => void;
  onFound?: (query: string, count: number) => void;
  onStarted?: () => void;
  onChecked?: (count: number) => void;
  onRefreshed?: (total: number) => void;
}

export interface ReadingListSignature {
  Args: ReadingListProps & { style?: unknown } & ReadingListEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class ReadingList extends Component<ReadingListSignature> {
  countShelf = async (name: string) => {
    const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
    const list = (await response.json()) as string[];
    this.counts = { ...this.counts, [name]: list.length };
  };

  refreshAll = async () => {
    this.refreshing = true;
    await Promise.all(this.args.shelves.map(this.countShelf));
    this.refreshing = false;
    this.args.onRefreshed?.(
      this.args.shelves.reduce((total, name) => total + (this.counts[name] ?? 0), 0),
    );
  };

  @tracked({ equals: Object.is }) query = "";

  @tracked({ equals: Object.is }) books: string[] = [];

  @tracked({ equals: Object.is }) searching = false;

  @tracked({ equals: Object.is }) failure = "";

  @tracked({ equals: Object.is }) shelf = "all";

  @tracked({ equals: Object.is }) checking = false;

  @tracked({ equals: Object.is }) checks = 0;

  @tracked({ equals: Object.is }) counts: Record<string, number> = {};

  @tracked({ equals: Object.is }) refreshing = false;

  checker: ReturnType<typeof setInterval> | undefined;

  readonly watcher1 = new Watcher(
    this,
    () => this.shelf,
    (value) => {
      localStorage.setItem("reading-list:shelf", value);
    },
  );

  readonly watcher2 = new Watcher(
    this,
    () => this.query,
    async (value, previous, onCleanup) => {
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      if (value === "") {
        this.books = [];
        this.searching = false;
        return;
      }
      const url = `/api/books?${new URLSearchParams({ q: value, shelf: this.shelf })}`;
      this.searching = true;
      this.failure = "";
      this.args.onRequested?.(url);
      try {
        const response = await fetch(url, { signal: controller.signal });
        const found = (await response.json()) as string[];
        this.books = found;
        this.searching = false;
        this.args.onFound?.(value, found.length);
      } catch (error) {
        if (controller.signal.aborted) {
          this.args.onCancelled?.(value);
          return;
        }
        this.searching = false;
        this.failure = error instanceof Error ? error.message : "The search failed";
      }
    },
  );

  readonly effect1 = new Effect(this, (onCleanup) => {
    if (!this.checking) return;
    const check = () => {
      this.checks += 1;
      this.args.onChecked?.(this.checks);
    };
    this.checker = setInterval(check, 1000);
    this.args.onStarted?.();
    onCleanup(() => clearInterval(this.checker));
  });

  listener1 = (event: HTMLElementEventMap["input"]) =>
    (this.query = (event.currentTarget as HTMLInputElement).value);

  get value1() {
    return this.searching ? "Searching" : `${this.books.length} found`;
  }

  get value2() {
    return this.failure === "" ? "" : `: ${this.failure}`;
  }

  get value3() {
    return this.shelf === "all";
  }

  listener2 = () => (this.shelf = "all");

  get value4() {
    return this.shelf === "unread";
  }

  listener3 = () => (this.shelf = "unread");

  listener4 = () => (this.checking = !this.checking);

  value5 = (name: NonNullable<this["args"]["shelves"]>[number]) =>
    this.counts[name] ?? "not counted";

  get value6() {
    return this.refreshing ? "Refreshing" : "Up to date";
  }

  <template>{{(this.watcher1.flush)}}{{(this.watcher2.flush)}}<section
      class="reading-list"
      aria-label="Reading list"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Search<input type="search" name="query" {{on "input" this.listener1}}></label><p
      role="status"
    >{{this.value1}}{{this.value2}}</p><ul
      aria-label="Books"
    >{{#each this.books key="@identity" as |book|}}<li>{{book}}</li>{{/each}}</ul><div
      role="group"
      aria-label="Shelf"
    ><button
      type="button"
      aria-pressed={{enumeratedValue this.value3}}
      {{on "click" this.listener2}}
    >All</button><button
      type="button"
      aria-pressed={{enumeratedValue this.value4}}
      {{on "click" this.listener3}}
    >Unread</button></div><button
      type="button"
      aria-pressed={{enumeratedValue this.checking}}
      {{on "click" this.listener4}}
    >Check for new books</button><p>Checks: {{this.checks}}</p><button
      type="button"
      {{on "click" this.refreshAll}}
    >Refresh shelves</button><ul
      aria-label="Shelves"
    >{{#each @shelves key="@identity" as |name|}}<li>{{name}}: {{this.value5 name}}</li>{{/each}}</ul><p>{{this.value6}}</p></section>{{(this.effect1.flush)}}</template>
}

/**
 * Vue's `watchEffect`: the template calls `flush` after everything else, so the effect runs
 * once the component has rendered in the browser, and again when what it read changes. A
 * cleanup it registers runs before its next run, and when the component is destroyed.
 */
class Effect {
  @tracked ready = false;
  readonly #owner: object;
  readonly #effect: (onCleanup: (cleanup: () => void) => void) => unknown;
  #cleanup: (() => void) | undefined;

  constructor(owner: object, effect: (onCleanup: (cleanup: () => void) => void) => unknown) {
    this.#owner = owner;
    this.#effect = effect;
    registerDestructor(owner, () => this.#cleanup?.());
    void renderSettled().then(() => {
      if (!isDestroying(owner)) this.ready = true;
    });
  }

  readonly flush = (): undefined => {
    if (!this.ready) return undefined;
    // A watcher's callback is still to run after this render: the effect runs once after it,
    // and sees what it writes. Writing `ready` again renders this call again then.
    if (callbacks.pending) {
      queueMicrotask(() => {
        if (!isDestroying(this.#owner)) this.ready = true;
      });
      return undefined;
    }
    const cleanup = this.#cleanup;
    this.#cleanup = undefined;
    cleanup?.();
    void this.#effect((each) => {
      this.#cleanup = each;
    });
    return undefined;
  };
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

/** How many watchers' callbacks are to run once the current render is done. */
const callbacks = { pending: 0 };

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
}

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
