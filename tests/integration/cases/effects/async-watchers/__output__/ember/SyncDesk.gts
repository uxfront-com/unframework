import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { capabilities, setModifierManager } from "@ember/modifier";
import { renderSettled } from "@ember/renderer";
import type { ModifierLike } from "@glint/template";

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export interface SyncDeskProps {
  files: string[];
}

export interface SyncDeskEvents {
  onChecked?: (email: string) => void;
  onSummary?: (text: string) => void;
  onFocused?: (name: string) => void;
  onProgress?: (step: string, owner: string) => void;
  onSaveState?: (error: string, name: string) => void;
  onSavedName?: (name: string) => void;
  onImportState?: (status: string, count: number) => void;
  onSettled?: (note: string) => void;
  onSending?: (busy: boolean, outcome: string) => void;
  onSent?: (count: number) => void;
  onClamped?: (level: number) => void;
}

export interface SyncDeskSignature {
  Args: SyncDeskProps & { style?: unknown } & SyncDeskEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class SyncDesk extends Component<SyncDeskSignature> {
  ask = (): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      this.waiting = [...this.waiting, { resolve, reject }];
    });
  };

  answer = (text: string) => {
    const [first, ...rest] = this.waiting;
    this.waiting = rest;
    first?.resolve(text);
  };

  fail = () => {
    const [first, ...rest] = this.waiting;
    this.waiting = rest;
    first?.reject(new Error("offline"));
  };

  validate = async (value: string): Promise<boolean> => {
    return value.includes("@");
  };

  suggest = async () => {
    this.email = "ada@lovelace.dev";
    await renderSettled();
    this.confirm?.focus();
    this.args.onFocused?.(document.activeElement?.textContent ?? "none");
  };

  load = async () => {
    this.step = "owner";
    this.owner = await this.ask();
    this.step = "editor";
    this.editor = await this.ask();
    this.step = "done";
  };

  persist = async (value: string) => {
    this.saving = value;
    await this.ask();
    this.saving = "";
  };

  save = async () => {
    this.error = "";
    const payload = this.name.trim();
    if (!payload) {
      this.error = "Name required";
      return;
    }
    await this.persist(payload);
    this.args.onSavedName?.(payload);
  };

  importAll = async () => {
    this.imported = 0;
    this.status = "starting";
    for (const file of this.args.files) {
      this.status = `importing ${file}`;
      await this.ask();
      this.imported += 1;
    }
    this.status = "done";
  };

  refresh = () => {
    this.note = "refreshing";
    void this.ask()
      .then((text) => {
        this.note = `refreshed by ${text}`;
      })
      .finally(() => {
        this.args.onSettled?.(this.note);
      });
  };

  prefetch = async () => {
    const pending = this.ask();
    this.note = "waiting";
    const text = await pending;
    this.note = `prefetched by ${text}`;
  };

  send = async () => {
    this.sendBusy = true;
    this.outcome = "";
    try {
      const reply = await this.ask();
      if (reply === "") {
        this.outcome = "Declined";
        this.sendBusy = false;
        return;
      }
      this.total += 1;
    } catch (failure) {
      this.outcome = failure instanceof Error ? failure.message : "Failed";
      this.sendBusy = false;
      return;
    }
    this.sendBusy = false;
    this.outcome = `Sent ${this.total}`;
    this.args.onSent?.(this.total);
  };

  apply = (value: number) => {
    if (value > 10) value = 10;
    this.level = value;
    this.args.onClamped?.(value);
  };

  waiting: Waiting[] = [];

  @tracked({ equals: Object.is }) email = "ada@example.com";

  @tracked({ equals: Object.is }) checking = false;

  @tracked({ equals: Object.is }) valid = true;

  @tracked confirm: HTMLButtonElement | null = null;

  readonly watcher1 = new Watcher(
    this,
    () => this.email,
    async (value) => {
      this.checking = true;
      const ok = await this.validate(value);
      this.checking = false;
      this.valid = ok;
    },
  );

  readonly watcher2 = new Watcher(
    this,
    () => this.email,
    (value) => {
      this.args.onChecked?.(value);
    },
    { post: true },
  );

  readonly effect1 = new Effect(this, () => {
    this.args.onSummary?.(`${this.email} is ${this.valid ? "valid" : "invalid"}`);
  });

  @tracked({ equals: Object.is }) step = "idle";

  @tracked({ equals: Object.is }) owner = "nobody";

  @tracked({ equals: Object.is }) editor = "nobody";

  readonly watcher3 = new Watcher(
    this,
    () => sources(this.step, this.owner),
    ([current, who]) => {
      this.args.onProgress?.(current, who);
    },
    { array: true },
  );

  @tracked({ equals: Object.is }) name = "";

  @tracked({ equals: Object.is }) error = "";

  @tracked({ equals: Object.is }) saving = "";

  readonly watcher4 = new Watcher(
    this,
    () => sources(this.error, this.saving),
    ([message, current]) => {
      this.args.onSaveState?.(message, current);
    },
    { array: true },
  );

  @tracked({ equals: Object.is }) status = "idle";

  @tracked({ equals: Object.is }) imported = 0;

  readonly watcher5 = new Watcher(
    this,
    () => sources(this.status, this.imported),
    ([text, count]) => {
      this.args.onImportState?.(text, count);
    },
    { array: true },
  );

  @tracked({ equals: Object.is }) note = "idle";

  @tracked({ equals: Object.is }) sendBusy = false;

  @tracked({ equals: Object.is }) outcome = "";

  @tracked({ equals: Object.is }) total = 0;

  readonly watcher6 = new Watcher(
    this,
    () => sources(this.sendBusy, this.outcome),
    ([sendingNow, text]) => {
      this.args.onSending?.(sendingNow, text);
    },
    { array: true },
  );

  @tracked({ equals: Object.is }) volume = 4;

  @tracked({ equals: Object.is }) level = 4;

  readonly watcher7 = new Watcher(
    this,
    () => this.volume,
    (next) => {
      this.apply(next * 2);
    },
  );

  get value1() {
    return this.checking ? "checking" : this.valid ? "valid" : "invalid";
  }

  listener1 = (event: HTMLElementEventMap["input"]) =>
    (this.name = (event.currentTarget as HTMLInputElement).value);

  get value2() {
    return this.saving === "" ? this.error || "Not saving" : `Saving ${this.saving}`;
  }

  get value3() {
    return this.sendBusy ? "sending" : this.outcome === "" ? "not sent" : this.outcome;
  }

  listener2 = () => (this.volume += 3);

  listener3 = () => this.answer("Ada");

  listener4 = () => this.answer("");

  <template>{{(this.watcher1.flush)}}{{(this.watcher2.flush)}}{{(this.watcher3.flush)}}{{(this.watcher4.flush)}}{{(this.watcher5.flush)}}{{(this.watcher6.flush)}}{{(this.watcher7.flush)}}<section
      class="sync-desk"
      aria-label="Sync desk"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button type="button" {{on "click" this.suggest}}>Suggest</button><button
      type="button"
      {{templateRef this "confirm"}}
    >Use this email</button><p>{{this.email}}: {{this.value1}}</p><button
      type="button"
      {{on "click" this.load}}
    >Load</button><p>Step: {{this.step}}, owner {{this.owner}}, editor {{this.editor}}</p><label>Name<input
      name="name"
      {{on "input" this.listener1}}
    ></label><button type="button" {{on "click" this.save}}>Save</button><p>{{this.value2}}</p><button
      type="button"
      {{on "click" this.importAll}}
    >Import</button><p>Import: {{this.status}}, {{this.imported}} imported</p><button
      type="button"
      {{on "click" this.refresh}}
    >Refresh</button><button type="button" {{on "click" this.prefetch}}>Prefetch</button><p>Note: {{this.note}}</p><button
      type="button"
      {{on "click" this.send}}
    >Send</button><p>Send: {{this.value3}}</p><button
      type="button"
      {{on "click" this.listener2}}
    >Louder</button><p>Level: {{this.level}}</p><div
      role="group"
      aria-label="Server"
    ><button type="button" {{on "click" this.listener3}}>Reply</button><button
      type="button"
      {{on "click" this.listener4}}
    >Decline</button><button type="button" {{on "click" this.fail}}>Fail</button></div></section>{{(this.effect1.flush)}}</template>
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
