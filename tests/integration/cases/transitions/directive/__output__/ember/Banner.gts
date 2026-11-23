import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";
import { vMark } from "./vMark.ts";
import "./Banner.uf.tsx.css";

export interface BannerSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Banner extends Component<BannerSignature> {
  @tracked shown = true;

  listener1 = () => (this.shown = false);

  listener2 = (): number => (this.shown ? 0 : -1);

  <template><section
      aria-label="News"
      data-uf-53025c4a=""
      style={{fallthroughStyle @style}}
      ...attributes
    ><button type="button" {{on "click" this.listener1}} data-uf-53025c4a="">Dismiss</button>{{#let (transition this.listener2 "fade" false) as |transitionList|}}{{#each transitionList.entries key="id" as |entry|}}{{#unless entry.gone}}{{#if (eq entry.branch 0)}}<p
      {{transitionClasses entry}}
      class="banner"
      {{vMark "banner"}}
      data-uf-53025c4a=""
    >New releases are out.</p>{{/if}}{{/unless}}{{/each}}{{/let}}</section></template>
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

/** An element a transition renders: its branch, and the phase of Vue's classes it runs. */
class TransitionEntry {
  static #ids = 0;
  readonly id = String(++TransitionEntry.#ids);
  readonly name: string;
  readonly branch: number;
  @tracked phase: "enter" | "leave" | undefined;
  /** Set once its leave has ended: the template no longer renders it. */
  @tracked gone = false;

  constructor(name: string, branch: number, phase: "enter" | "leave" | undefined) {
    this.name = name;
    this.branch = branch;
    this.phase = phase;
  }
}

/**
 * Vue's `<Transition>` of one element, or of a conditional's branches: the entry of the branch
 * `branch` shows, `-1` for none, after each entry whose leave still runs. A change of the
 * branch starts the old entry's leave and the new one's enter. The first entry enters only with
 * `appear`, and only in the browser.
 */
class Transition {
  readonly #name: string;
  readonly #branch: () => number;
  readonly #appear: boolean;
  #started = false;
  #current: TransitionEntry | undefined;
  #entries: TransitionEntry[] = [];

  constructor(branch: () => number, name: string, appear: boolean) {
    this.#branch = branch;
    this.#name = name;
    this.#appear = appear;
  }

  get entries(): readonly TransitionEntry[] {
    const branch = this.#branch();
    if (!this.#started || this.#current?.branch !== branch) {
      const phase = this.#started || (this.#appear && !import.meta.env.SSR) ? "enter" : undefined;
      if (this.#current) this.#current.phase = "leave";
      this.#current = branch < 0 ? undefined : new TransitionEntry(this.#name, branch, phase);
      this.#started = true;
    }
    const current = this.#current;
    this.#entries = this.#entries.filter((each) => !each.gone && each !== current);
    if (current) this.#entries.push(current);
    return this.#entries.slice();
  }
}

/** A transition for each block that renders one, so a block rendered again starts anew. */
function transition(branch: () => number, name: string, appear: boolean): Transition {
  return new Transition(branch, name, appear);
}

interface TransitionState {
  element?: Element;
  stop?: () => void;
}

/**
 * Runs Vue's classes of its entry's phase on its element: `-from` and `-active` first, `-to`
 * for `-from` two frames later, and none once the element's own `transitionend` or
 * `animationend` fires, or its longest duration and delay pass. A leave that ends marks the
 * entry gone. A phase that starts while another runs stops it first. Nothing runs on the server.
 */
const transitionClasses = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: (): TransitionState => ({}),
    installModifier(
      state: TransitionState,
      element: Element,
      { positional }: { positional: readonly unknown[] },
    ) {
      runTransition(state, element, positional[0] as TransitionEntry);
    },
    updateModifier(state: TransitionState, { positional }: { positional: readonly unknown[] }) {
      const element = state.element;
      if (element) runTransition(state, element, positional[0] as TransitionEntry);
    },
    destroyModifier(state: TransitionState) {
      state.stop?.();
    },
  }),
  {},
) as unknown as ModifierLike<{ Element: Element; Args: { Positional: [entry: TransitionEntry] } }>;

function runTransition(state: TransitionState, element: Element, entry: TransitionEntry): void {
  state.element = element;
  const phase = entry.phase;
  if (import.meta.env.SSR || !phase) return;
  state.stop?.();
  const from = `${entry.name}-${phase}-from`;
  const active = `${entry.name}-${phase}-active`;
  const to = `${entry.name}-${phase}-to`;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let type: "transitionend" | "animationend" = "transitionend";
  let count = 0;
  // Vue's `whenTransitionEnds`: one end event for each property of the longer kind.
  const ended = (event: Event) => {
    if (event.target === element && --count <= 0) finish();
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    element.removeEventListener(type, ended);
    element.classList.remove(from, active, to);
    if (state.stop === stop) state.stop = undefined;
  };
  const finish = () => {
    stop();
    if (entry.phase !== phase) return;
    entry.phase = undefined;
    if (phase === "leave") entry.gone = true;
  };
  state.stop = stop;
  element.classList.add(from, active);
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      element.classList.remove(from);
      element.classList.add(to);
      const style = getComputedStyle(element);
      const longest = (delays: string, durations: string) => {
        const each = (list: string) =>
          list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
        const delay = each(delays);
        return Math.max(
          0,
          ...each(durations).map(
            (duration, index) => duration + (delay[index % delay.length] ?? 0),
          ),
        );
      };
      const transitions = longest(style.transitionDelay, style.transitionDuration);
      const animations = longest(style.animationDelay, style.animationDuration);
      const timeout = Math.max(transitions, animations);
      if (!timeout) return finish();
      type = transitions >= animations ? "transitionend" : "animationend";
      count = (type === "transitionend" ? style.transitionDuration : style.animationDuration).split(
        ", ",
      ).length;
      element.addEventListener(type, ended);
      timer = setTimeout(finish, timeout + 1);
    });
  });
}
