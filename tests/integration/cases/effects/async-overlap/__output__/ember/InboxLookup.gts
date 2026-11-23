import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

export interface InboxLookupEvents {
  onLooked?: (sender: string) => void;
  onDropped?: (sender: string) => void;
  onSorted?: (order: string) => void;
  onScaled?: (order: string) => void;
  onBusy?: (count: number, loading: boolean) => void;
  onFailed?: (message: string, loading: boolean) => void;
  onCounted?: (count: number) => void;
}

export interface InboxLookupSignature {
  Args: { style?: unknown } & InboxLookupEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class InboxLookup extends Component<InboxLookupSignature> {
  lookupReply = (): Promise<string> => {
    return new Promise<string>((resolve) => {
      this.lookupReplies = [...this.lookupReplies, resolve];
    });
  };

  answerLookups = () => {
    const waiting = this.lookupReplies;
    this.lookupReplies = [];
    waiting.forEach((resolve) => resolve("found"));
  };

  request = (): Promise<string[]> => {
    return new Promise<string[]>((resolve, reject) => {
      this.respond = resolve;
      this.fail = reject;
    });
  };

  load = async () => {
    this.loading = true;
    this.failure = "";
    try {
      const list = await this.request();
      this.messages = list;
    } catch (error) {
      this.failure = error instanceof Error ? error.message : "unknown";
    }
    this.loading = false;
  };

  refresh = async () => {
    this.loading = true;
    this.messages = await this.request();
    this.loading = false;
  };

  markTwice = async () => {
    const bump = () => {
      this.unread += 1;
    };
    bump();
    bump();
    await renderSettled();
    bump();
    bump();
  };

  @tracked({ equals: Object.is }) sender = "";

  @tracked({ equals: Object.is }) order = "newest";

  @tracked({ equals: Object.is }) answers: string[] = [];

  @tracked({ equals: Object.is }) ordering = "none";

  @tracked({ equals: Object.is }) messages: string[] = [];

  @tracked({ equals: Object.is }) loading = false;

  @tracked({ equals: Object.is }) failure = "";

  @tracked({ equals: Object.is }) unread = 0;

  lookupReplies: ((text: string) => void)[] = [];

  orderReply: ((text: string) => void) | undefined;

  respond: ((list: string[]) => void) | undefined;

  fail: ((error: Error) => void) | undefined;

  readonly watcher1 = new Watcher(
    this,
    () => this.sender,
    async (value, previous, onCleanup) => {
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
        this.args.onDropped?.(value);
      });
      this.args.onLooked?.(value);
      const text = await this.lookupReply();
      if (!cancelled) {
        this.answers = [...this.answers, `${value}: ${text}`];
      }
    },
  );

  readonly effect1 = new Effect(this, async (onCleanup) => {
    const current = this.order;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    this.args.onSorted?.(current);
    const text = await new Promise<string>((resolve) => {
      this.orderReply = resolve;
    });
    if (!cancelled) {
      this.ordering = `${current} ${text}`;
      this.args.onScaled?.(current);
    }
  });

  readonly watcher2 = new Watcher(
    this,
    () => sources(this.messages, this.loading),
    ([list, busy]) => {
      this.args.onBusy?.(list.length, busy);
    },
    { array: true },
  );

  readonly watcher3 = new Watcher(
    this,
    () => sources(this.failure, this.loading),
    ([message, busy]) => {
      this.args.onFailed?.(message, busy);
    },
    { array: true },
  );

  readonly watcher4 = new Watcher(
    this,
    () => this.unread,
    (value) => {
      this.args.onCounted?.(value);
    },
  );

  listener1 = () => (this.sender = "Ann");

  listener2 = () => (this.sender = "Anna");

  listener3 = () => (this.order = this.order === "newest" ? "oldest" : "newest");

  listener4 = () => this.orderReply?.("ready");

  listener5 = () => this.respond?.(["Hello", "Welcome"]);

  listener6 = () => this.fail?.(new Error("offline"));

  get value1() {
    return this.loading ? "Loading" : `${this.messages.length} messages`;
  }

  get value2() {
    return this.failure === "" ? "" : `, ${this.failure}`;
  }

  <template>{{(this.watcher1.flush)}}{{(this.watcher2.flush)}}{{(this.watcher3.flush)}}{{(this.watcher4.flush)}}<section
      class="inbox-lookup"
      aria-label="Inbox"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button type="button" {{on "click" this.listener1}}>Find Ann</button><button
      type="button"
      {{on "click" this.listener2}}
    >Find Anna</button><button
      type="button"
      {{on "click" this.answerLookups}}
    >Answer lookups</button><ol
      aria-label="Answers"
    >{{#each this.answers key="@index" as |line|}}<li>{{line}}</li>{{/each}}</ol><button
      type="button"
      {{on "click" this.listener3}}
    >Switch order</button><button type="button" {{on "click" this.listener4}}>Answer order</button><p>Order: {{this.ordering}}</p><button
      type="button"
      {{on "click" this.load}}
    >Load</button><button type="button" {{on "click" this.refresh}}>Refresh</button><button
      type="button"
      {{on "click" this.listener5}}
    >Reply</button><button type="button" {{on "click" this.listener6}}>Fail</button><p
      role="status"
    >{{this.value1}}{{this.value2}}</p><button
      type="button"
      {{on "click" this.markTwice}}
    >Mark twice</button><p>Unread: {{this.unread}}</p></section>{{(this.effect1.flush)}}</template>
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
