import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

export interface MailboxProps {
  folder: string;
}

export interface MailboxEvents {
  onLoaded?: (name: string, unread: number) => void;
  onProgress?: (status: string, attempts: number) => void;
  onSeen?: (text: string) => void;
  onNoted?: (text: string) => void;
}

export interface MailboxSignature {
  Args: MailboxProps & { style?: unknown } & MailboxEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class Mailbox extends Component<MailboxSignature> {
  save = async () => {
    const label = this.name.trim();
    this.status = `saving ${label}`;
    this.attempts += 1;
    await renderSettled();
    this.status = "saved";
  };

  refreshEverySecond = () => {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.name = `${this.args.folder} (refreshed)`;
      this.unread += 1;
    }, 1000);
  };

  markAllRead = () => {
    queueMicrotask(() => {
      this.unread = 0;
      this.name = `${this.args.folder}, all read`;
    });
  };

  note = () => {
    void Promise.resolve().then(() => {
      this.args.onNoted?.(`${this.name}: ${this.unread}`);
    });
  };

  @tracked({ equals: Object.is }) name = "Loading";

  @tracked({ equals: Object.is }) unread = 0;

  @tracked({ equals: Object.is }) status = "idle";

  @tracked({ equals: Object.is }) attempts = 0;

  @tracked({ equals: Object.is }) summary = "No messages";

  timer: ReturnType<typeof setInterval> | undefined;

  readonly watcher1 = new Watcher(
    this,
    () => sources(this.name, this.unread),
    ([nextName, nextUnread]) => {
      this.args.onLoaded?.(nextName, nextUnread);
    },
    { array: true },
  );

  readonly watcher2 = new Watcher(
    this,
    () => sources(this.status, this.attempts),
    ([nextStatus, nextAttempts]) => {
      this.args.onProgress?.(nextStatus, nextAttempts);
    },
    { array: true },
  );

  readonly watcher3 = new Watcher(
    this,
    () => this.unread,
    async (value) => {
      const text = await Promise.resolve(`${value} unread`);
      this.summary = text;
    },
  );

  readonly effect1 = new Effect(this, async () => {
    const text = `${this.status} after ${this.attempts}`;
    await Promise.resolve();
    this.args.onSeen?.(text);
  });

  #mounted = false;

  /** Called at the template's end: the hooks run once the component has rendered. */
  onMounted = (): undefined => {
    if (!this.#mounted) {
      this.#mounted = true;
      afterRender(this, async () => {
        await Promise.resolve();
        this.name = this.args.folder;
        this.unread = 3;
      });
      afterRender(this, () =>
        registerDestructor(this, () => {
          clearInterval(this.timer);
        }),
      );
    }
    return undefined;
  };

  <template>{{(this.watcher1.flush)}}{{(this.watcher2.flush)}}{{(this.watcher3.flush)}}<section
      class="mailbox"
      aria-label="Mailbox"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>{{this.name}}</h2><p role="status">{{this.summary}}</p><p>Status: {{this.status}}</p><button
      type="button"
      {{on "click" this.save}}
    >Save</button><button
      type="button"
      {{on "click" this.refreshEverySecond}}
    >Refresh every second</button><button
      type="button"
      {{on "click" this.markAllRead}}
    >Mark all read</button><button type="button" {{on "click" this.note}}>Note</button></section>{{(this.effect1.flush)}}{{(this.onMounted)}}</template>
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

/** An array of watch sources, typed as a tuple. */
function sources<T extends unknown[]>(...values: T): T {
  return values;
}
