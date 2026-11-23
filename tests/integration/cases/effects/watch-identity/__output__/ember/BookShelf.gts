import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

export interface Book {
  id: number;
  title: string;
}

export interface BookShelfProps {
  books: Book[];
}

export interface BookShelfEvents {
  onMoved?: (title: string, previous: string) => void;
  onCounted?: (summary: string) => void;
  onToggled?: (open: boolean) => void;
  onBusy?: (label: string, loading: boolean) => void;
  onSummed?: (total: number) => void;
}

export interface BookShelfSignature {
  Args: BookShelfProps & { style?: unknown } & BookShelfEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class BookShelf extends Component<BookShelfSignature> {
  sum = (values: number[]): number => {
    return values.reduce((total, value) => total + value, 0);
  };

  focus = (book: Book) => {
    this.focused = book;
  };

  peek = (book: Book) => {
    const before = this.focused;
    this.focused = book;
    this.focused = before;
  };

  read = (book: Book) => {
    const next = new Map(this.reads);
    next.set(book.id, (next.get(book.id) ?? 0) + 1);
    this.reads = next;
  };

  reread = () => {
    const before = this.reads;
    this.reads = new Map();
    this.reads = before;
  };

  start = () => {
    this.label = "Loading";
    this.loading = true;
  };

  @tracked focused: Book | null = null;

  @tracked reads = new Map<number, number>();

  @tracked open = false;

  @tracked label = "Idle";

  @tracked loading = false;

  @tracked low = 1;

  @tracked high = 5;

  readonly watcher1 = new Watcher(
    this,
    () => this.focused,
    (book, previous) => {
      this.args.onMoved?.(book?.title ?? "none", previous?.title ?? "none");
    },
  );

  readonly watcher2 = new Watcher(
    this,
    () => this.reads,
    (next) => {
      this.args.onCounted?.([...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
    },
  );

  readonly watcher3 = new Watcher(
    this,
    () => this.open,
    (value) => {
      this.args.onToggled?.(value);
    },
    { immediate: true },
  );

  readonly watcher4 = new Watcher(
    this,
    () => sources(this.label, this.loading),
    ([nextLabel, nextLoading]) => {
      this.args.onBusy?.(nextLabel, nextLoading);
    },
    { array: true },
  );

  readonly watcher5 = new Watcher(
    this,
    () => sources(this.low, this.high),
    (values) => {
      this.args.onSummed?.(this.sum(values));
    },
    { array: true },
  );

  value1 = (book: NonNullable<this["args"]["books"]>[number]) => `Focus ${book.title}`;

  listener1 = (book: NonNullable<this["args"]["books"]>[number]) => () => this.focus(book);

  value2 = (book: NonNullable<this["args"]["books"]>[number]) => `Peek ${book.title}`;

  listener2 = (book: NonNullable<this["args"]["books"]>[number]) => () => this.peek(book);

  value3 = (book: NonNullable<this["args"]["books"]>[number]) => `Read ${book.title}`;

  listener3 = (book: NonNullable<this["args"]["books"]>[number]) => () => this.read(book);

  get value4() {
    return this.focused?.title ?? "none";
  }

  listener4 = () => (this.open = !this.open);

  get value5() {
    return this.loading ? "busy" : "idle";
  }

  listener5 = () => (this.high += 1);

  <template>{{(this.watcher1.flush)}}{{(this.watcher2.flush)}}{{(this.watcher3.flush)}}{{(this.watcher4.flush)}}{{(this.watcher5.flush)}}<section
      class="book-shelf"
      aria-label="Books"
      style={{fallthroughStyle @style}}
      ...attributes
    ><ul
      aria-label="Shelf"
    >{{#each @books key="id" as |book|}}<li><span>{{book.title}}</span><button
      type="button"
      {{on "click" (this.listener1 book)}}
    >{{this.value1 book}}</button><button
      type="button"
      {{on "click" (this.listener2 book)}}
    >{{this.value2 book}}</button><button
      type="button"
      {{on "click" (this.listener3 book)}}
    >{{this.value3 book}}</button></li>{{/each}}</ul><p>Focused: {{this.value4}}</p><p>Books read: {{this.reads.size}}</p><button
      type="button"
      {{on "click" this.reread}}
    >Count again</button><button
      type="button"
      aria-expanded={{enumeratedValue this.open}}
      {{on "click" this.listener4}}
    >Details</button><button type="button" {{on "click" this.start}}>Start</button><p
      role="status"
    >{{this.label}}: {{this.value5}}</p><button
      type="button"
      {{on "click" this.listener5}}
    >Raise the limit</button><p>Range: {{this.low}} to {{this.high}}</p></section></template>
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

/** An array of watch sources, typed as a tuple. */
function sources<T extends unknown[]>(...values: T): T {
  return values;
}
