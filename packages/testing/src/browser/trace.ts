// L9, interaction traces (plan §7.2, ADR-0050): after every scripted step (a user's action, a
// rerender) the view records what a person would see: the normalised DOM, the ARIA tree and
// the events emitted since the step before. `expectParity` compares the steps since the
// previous one with `__expected__/trace.<name>.json`, which the reference writes, so every
// target must go through the same states, in the same order, emitting the same events.
import { renameGeneratedIds } from "../normalize/rules/generated-ids.ts";
import { groupEvents, renumberIds } from "./events.ts";
import type { EmittedEvent } from "./events.ts";

/** The trace format's version: bumped on every change to what a step records. */
export const TRACE_VERSION = 1;

/** One scripted step, after it settled. */
export interface TraceStep {
  /**
   * What happened, the same on every target: the action, the locator under the view's root,
   * and the action's arguments as JSON (`click getByRole('button', { name: '+3' })`,
   * `fill getByLabelText('Name') "Ada"`, `rerender {"label":"New"}`).
   */
  action: string;
  /** The normalised DOM, one line each, the focused element marked `uf:focused`. */
  dom: string[];
  /** Playwright's ARIA snapshot of the root, one line each. */
  aria: string[];
  /**
   * The events emitted since the step before (or since the mount), grouped by name: names
   * sorted, each name's argument lists in the order they came (the order of different effects
   * one run triggers is not part of the contract, ADR-0050).
   */
  events: Record<string, unknown[][]>;
}

/** What a view's trace needs to record a step: its DOM, its ARIA tree and its events so far. */
export interface TraceSource {
  /** The view's root, `uf-root-N`, for messages. */
  readonly root: string;
  /** The normalised DOM and the renaming of its generated ids. */
  dom(): { html: string; ids: Map<string, string> };
  aria(): Promise<string>;
  /** Every event the component emitted since it mounted. */
  readonly events: readonly EmittedEvent[];
}

/** The steps of one view not yet compared, and the events they have seen. */
export class Trace {
  readonly #source: TraceSource;
  #steps: TraceStep[] = [];
  /** How many of the view's events earlier steps took. */
  #cursor = 0;

  constructor(source: TraceSource) {
    this.#source = source;
    open.add(this);
  }

  /** Records a step, after the action settled. */
  async record(action: string): Promise<void> {
    const { html, ids } = this.#source.dom();
    // The ids the ARIA tree and a payload carry are renamed as this step's DOM renames them.
    const names = new Map(ids);
    const aria = renameGeneratedIds(await this.#source.aria(), names);
    const events = this.#source.events.slice(this.#cursor);
    this.#cursor += events.length;
    this.#steps.push({
      action,
      dom: lines(html),
      aria: lines(aria),
      events: groupEvents(
        events.map((event) => ({ ...event, args: renumberIds(event.args, names) as unknown[] })),
      ),
    });
  }

  /** The steps since the previous call, which `expectParity` compares; the trace forgets them. */
  take(): TraceStep[] {
    return this.#steps.splice(0);
  }

  /** The steps not taken yet, as a message, or nothing. */
  leftover(): string | undefined {
    if (!this.#steps.length) return undefined;
    const actions = this.#steps.map((step) => step.action).join("; ");
    return `${this.#steps.length} step(s) of ${this.#source.root} were never compared (${actions}): every view.user action and rerender is followed by an expectParity, which compares its trace.`;
  }
}

/** Every trace of the current test, which the setup file judges when it ends. */
const open = new Set<Trace>();

/**
 * The steps of the current test's views that no `expectParity` compared, as L9's failures, and
 * forgets every trace: the setup file calls it when a test ends.
 */
export function closeTraces(): string[] {
  const messages = [...open].flatMap((trace) => trace.leftover() ?? []);
  open.clear();
  return messages;
}

/** A trace file's contents: pretty JSON, so a diff names the line that changed. */
export function traceFile(steps: readonly TraceStep[]): string {
  return `${JSON.stringify({ version: TRACE_VERSION, steps }, null, 2)}\n`;
}

/** Text as lines, without the final line break. */
function lines(text: string): string[] {
  const trimmed = text.replace(/\n+$/, "");
  return trimmed ? trimmed.split("\n") : [];
}
