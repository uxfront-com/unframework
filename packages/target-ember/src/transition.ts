// `<Transition>` (ADR-0100). Glimmer removes an element once its `{{#if}}` turns false, so the
// output renders a transition's elements from a list, `Transition.entries`: the element of the
// branch its condition shows, and each one still leaving, until its leave ends. A modifier,
// `transitionClasses`, runs Vue's classes of an entry's phase on its element.

/** The imports the transition helpers need. */
export const TRANSITION_IMPORTS: Record<string, readonly string[]> = {
  "@ember/modifier": ["capabilities", "setModifierManager"],
  "@glint/template": ["type ModifierLike"],
};

/** The helpers: the entries, the transition that lists them, and the modifier. */
export const TRANSITION_HELPERS = `/** An element a transition renders: its branch, and the phase of Vue's classes it runs. */
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
 * Vue's \`<Transition>\` of one element, or of a conditional's branches: the entry of the branch
 * \`branch\` shows, \`-1\` for none, after each entry whose leave still runs. A change of the
 * branch starts the old entry's leave and the new one's enter. The first entry enters only with
 * \`appear\`, and only in the browser.
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
 * Runs Vue's classes of its entry's phase on its element: \`-from\` and \`-active\` first, \`-to\`
 * for \`-from\` two frames later, and none once the element's own \`transitionend\` or
 * \`animationend\` fires, or its longest duration and delay pass. A leave that ends marks the
 * entry gone. A phase that starts while another runs stops it first. Nothing runs on the server.
 */
const transitionClasses = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: (): TransitionState => ({}),
    installModifier(state: TransitionState, element: Element, { positional }: { positional: readonly unknown[] }) {
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
  const from = \`\${entry.name}-\${phase}-from\`;
  const active = \`\${entry.name}-\${phase}-active\`;
  const to = \`\${entry.name}-\${phase}-to\`;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let type: "transitionend" | "animationend" = "transitionend";
  let count = 0;
  // Vue's \`whenTransitionEnds\`: one end event for each property of the longer kind.
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
        const each = (list: string) => list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
        const delay = each(delays);
        return Math.max(0, ...each(durations).map((duration, index) => duration + (delay[index % delay.length] ?? 0)));
      };
      const transitions = longest(style.transitionDelay, style.transitionDuration);
      const animations = longest(style.animationDelay, style.animationDuration);
      const timeout = Math.max(transitions, animations);
      if (!timeout) return finish();
      type = transitions >= animations ? "transitionend" : "animationend";
      count = (type === "transitionend" ? style.transitionDuration : style.animationDuration).split(", ").length;
      element.addEventListener(type, ended);
      timer = setTimeout(finish, timeout + 1);
    });
  });
}`;
