import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

export interface BallotProps {
  limit: number;
  label?: string;
  choices: string[];
}

export interface BallotEvents {
  onVoted?: (remaining: number, text: string) => void;
  onMoved?: (line: string) => void;
  onReport?: (text: string) => void;
  onCounted?: (answers: number) => void;
}

export interface BallotSignature {
  Args: BallotProps & { style?: unknown } & BallotEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class Ballot extends Component<BallotSignature> {
  get label() {
    return this.args.label === undefined ? "Vote" : this.args.label;
  }

  isAnswer = (value: string): value is "yes" | "no" => {
    return value === "yes" || value === "no";
  };

  describe = (): string => {
    const line = `${this.picked} with ${this.votes} left`;
    return line;
  };

  vote = (choice: string) => {
    if (this.remaining > 0) this.remaining -= 1;
    this.text = `${this.text}!`;
    this.lastVotes = this.votes;
    this.votes -= 1;
    this.picked = this.isAnswer(choice) ? choice : "other";
    this.args.onVoted?.(this.remaining, `${this.text} ${this.lastVotes}`);
  };

  count = () => {
    let answers = 0;
    this.args.choices.forEach((choice) => this.isAnswer(choice) && answers++);
    this.args.onCounted?.(answers);
  };

  @tracked({ equals: Object.is }) votes = this.args.limit;

  @tracked({ equals: Object.is }) picked = "none";

  remaining = this.args.limit;

  text = `${this.label} (${this.args.limit})`;

  lastVotes = this.votes;

  readonly effect1 = new Effect(this, () => {
    this.args.onReport?.(this.describe());
  });

  readonly watcher1 = new Watcher(
    this,
    () => sources(this.votes, this.picked),
    ([nextVotes, nextPicked]: [number, string], [lastCount, lastPick]) => {
      this.args.onMoved?.(`${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
    },
    { array: true },
  );

  listener1 = (choice: NonNullable<this["args"]["choices"]>[number]) => () => this.vote(choice);

  <template>{{(this.watcher1.flush)}}<section
      class="ballot"
      aria-label={{this.label}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><p role="status">{{this.votes}} votes left</p><p>Picked: {{this.picked}}</p><ul
      aria-label="Choices"
    >{{#each @choices key="@identity" as |choice|}}<li><button
      type="button"
      {{on "click" (this.listener1 choice)}}
    >{{choice}}</button></li>{{/each}}</ul><button
      type="button"
      {{on "click" this.count}}
    >Count the answers</button></section>{{(this.effect1.flush)}}</template>
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
