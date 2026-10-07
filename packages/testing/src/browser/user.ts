// `view.user` (ADR-0050): real input, as a person gives it, through Playwright (CDP), for one
// view. An action is the inputs a person gives apart in time: the pointer moved onto an element,
// each press and release of a mouse button, each step of the wheel, each press and release of a
// key, a focus, a fill. Each input runs through the adapter's `interact` (React's `act`, Qwik's
// lazy handlers) and settles until the page is quiet before the next, as the time between two
// inputs lets a framework that renders in a task of its own render (Angular); the action then
// records one step of the view's trace (L9). Dispatched back to back, two inputs could land in
// one task of such a framework, and a watcher would be called back once for both, or not at
// all, by chance. A spec acts only through it: `userEvent` or a locator's own actions would skip
// all of this.
import { commands, userEvent } from "vitest/browser";
import type { Locator, UserEventWheelOptions } from "vitest/browser";

import "../commands.ts";
import type { InputRequest } from "../commands.ts";
import { assertInteractive } from "./capabilities.ts";
import { isCharacter, parseKeys } from "./keys.ts";
import type { KeyInput } from "./keys.ts";

/** Where a click presses: a point from the element's top left corner, its centre by default. */
export interface ClickOptions {
  position?: { x: number; y: number };
}

/** A person's input to one mounted view. Every target accepts a locator under the view's root. */
export interface ViewUser {
  /** Moves the mouse onto the element, then presses and releases its main button. */
  click(target: Locator, options?: ClickOptions): Promise<void>;
  /** Moves the mouse onto the element, then presses and releases its main button twice. */
  dblClick(target: Locator): Promise<void>;
  /** Moves the mouse onto the element, then presses and releases its main button three times. */
  tripleClick(target: Locator): Promise<void>;
  /** Moves the mouse over the element. */
  hover(target: Locator): Promise<void>;
  /** Moves the mouse off the element, onto the page's body. */
  unhover(target: Locator): Promise<void>;
  /** Focuses a field, then replaces its text with `text`, as pasting it would. */
  fill(target: Locator, text: string): Promise<void>;
  /**
   * Focuses the element, then presses and releases each key of `text` in turn (`{Enter}` names a
   * key, `{Shift>}` holds it, `{/Shift}` releases it), then releases every key still held.
   */
  type(target: Locator, text: string): Promise<void>;
  /** Focuses a field, then removes all its text. */
  clear(target: Locator): Promise<void>;
  /** Presses and releases each key of `text` where the focus is (`{Escape}`, `abc`), as `type`. */
  keyboard(text: string): Promise<void>;
  /** Moves the focus to the next (or, with `shift`, the previous) focusable element. */
  tab(options?: { shift?: boolean }): Promise<void>;
  /** Moves the focus to the element, as a script's `element.focus()` would. */
  focus(target: Locator): Promise<void>;
  /** Selects the options of a `<select>` with these values or labels. */
  selectOptions(target: Locator, values: string | readonly string[]): Promise<void>;
  /** Moves the mouse onto the element, then turns the wheel, a step at a time. */
  wheel(target: Locator, options: UserEventWheelOptions): Promise<void>;
}

/** One input of an action: dispatched alone, then settled before the next. */
export type Input = () => Promise<void>;

/** What the user needs from its view. */
export interface UserHost {
  /** The view's root locator's test id, `uf-root-N`: every target locator starts there. */
  readonly testId: string;
  /**
   * Runs an action as the view's step: each input through the adapter, settled before the next
   * is taken, then the step is recorded.
   */
  perform(action: string, inputs: Iterable<Input>): Promise<void>;
}

/**
 * The keys held down, across actions, as the page's keyboard holds them: `{Shift>}` adds one,
 * `{/Shift}` removes it. The page is one per test file, so this is too.
 */
const held = new Set<string>();

/** The user of a view. */
export function createUser(host: UserHost): ViewUser {
  // Async, so a refusal rejects as a failed action does.
  const act = async (
    kind: keyof ViewUser,
    target: Locator | undefined,
    args: readonly unknown[],
    // Called once the action is accepted, so a refused one dispatches nothing.
    inputs: () => Iterable<Input>,
  ): Promise<void> => {
    assertInteractive(`view.user.${kind}`);
    const parts = [
      kind,
      ...(target === undefined ? [] : [underRoot(host.testId, target, kind)]),
      ...args.filter((arg) => arg !== undefined).map((arg) => JSON.stringify(arg)),
    ];
    return host.perform(parts.join(" "), inputs());
  };
  return {
    click: (target, options) =>
      act("click", target, [nonEmpty(options)], () => clicks(target, 1, options?.position)),
    dblClick: (target) => act("dblClick", target, [], () => clicks(target, 2)),
    tripleClick: (target) => act("tripleClick", target, [], () => clicks(target, 3)),
    hover: (target) =>
      act("hover", target, [], () => [
        send({ kind: "move", locator: target.serialize(), check: "hover" }),
      ]),
    unhover: (target) => act("unhover", target, [], () => [() => userEvent.unhover(target)]),
    fill: (target, text) =>
      act("fill", target, [text], () => [focus(target), () => userEvent.fill(target, text)]),
    type: (target, text) =>
      act("type", target, [text], () => {
        const keys = parseKeys(text, "view.user.type", held);
        return (function* () {
          yield focus(target);
          yield* press(keys);
          // As Vitest's `type` does, and a person whose hands leave the keyboard.
          for (const key of [...held].toReversed()) yield release(key);
        })();
      }),
    clear: (target) =>
      act("clear", target, [], () => [focus(target), () => userEvent.clear(target)]),
    keyboard: (text) =>
      act("keyboard", undefined, [text], () => {
        const keys = parseKeys(text, "view.user.keyboard", held);
        return (function* () {
          // As Vitest's `keyboard` does: with the focus nowhere, the keys go to the frame.
          const active = document.activeElement;
          if (!active || active === document.body) window.focus();
          yield* press(keys);
        })();
      }),
    tab: (options = {}) => {
      const shift = options.shift === true;
      return act("tab", undefined, [shift ? { shift: true } : undefined], () => {
        const keys = parseKeys(shift ? "{Shift>}{Tab}{/Shift}" : "{Tab}", "view.user.tab", held);
        return (function* () {
          // Unlike a click, a key does not focus the frame: after a blur the sequential focus
          // would leave it.
          window.focus();
          yield* press(keys);
        })();
      });
    },
    focus: (target) => act("focus", target, [], () => [focus(target)]),
    selectOptions: (target, values) => {
      const list = typeof values === "string" ? [values] : [...values];
      return act("selectOptions", target, [list], () => [
        () => userEvent.selectOptions(target, list),
      ]);
    },
    wheel: (target, options) =>
      act("wheel", target, [options], () => {
        const { deltaX, deltaY, times } = wheelSteps(options);
        return (function* () {
          yield send({ kind: "move", locator: target.serialize(), check: "hover" });
          for (let step = 0; step < times; step += 1) yield send({ kind: "wheel", deltaX, deltaY });
        })();
      }),
  };
}

/** An input `ufInput` dispatches. */
function send(request: InputRequest): Input {
  return async () => {
    await commands.ufInput(request);
  };
}

/** The focus moved to the element, as Playwright's `locator.focus()` does. */
function focus(target: Locator): Input {
  return async () => {
    await commands.ufFocus(target.serialize());
  };
}

/** The mouse moved onto the element, then its main button pressed and released `count` times. */
function clicks(target: Locator, count: number, position?: { x: number; y: number }): Input[] {
  const inputs = [
    send({
      kind: "move",
      locator: target.serialize(),
      ...(position ? { position } : {}),
      check: "click",
    }),
  ];
  for (let clickCount = 1; clickCount <= count; clickCount += 1) {
    inputs.push(send({ kind: "press", clickCount }), send({ kind: "release", clickCount }));
  }
  return inputs;
}

/**
 * Each key's press and its release, as inputs of their own. A character the keyboard layout
 * lacks is inserted as text, and has no release. Read lazily: whether a key is held is known
 * once its press has run.
 */
function* press(keys: readonly KeyInput[]): Generator<Input> {
  for (const { key, text, press: down, release: up } of keys) {
    if (down) {
      yield async () => {
        const { inserted } = await commands.ufInput({ kind: "keydown", key, text });
        if (!inserted) held.add(key);
      };
    }
    if (up && held.has(key)) yield release(key);
  }
}

/** A held key's release. */
function release(key: string): Input {
  return async () => {
    await commands.ufInput({ kind: "keyup", key, text: isCharacter(key) });
    held.delete(key);
  };
}

/**
 * Releases every key a test left held, after its views are unmounted, so the next test starts
 * with none. Nothing settles: no view is left to settle.
 */
export async function releaseKeys(): Promise<void> {
  for (const key of [...held].toReversed()) await release(key)();
}

/** The wheel's steps, as Vitest's `wheel` reads its options: a direction is 100 pixels. */
function wheelSteps(options: UserEventWheelOptions): {
  deltaX: number;
  deltaY: number;
  times: number;
} {
  const times = options.times ?? 1;
  if (!Number.isSafeInteger(times) || times < 1) {
    throw new TypeError(
      `view.user.wheel: the wheel turns a positive whole number of times, not ${String(times)}.`,
    );
  }
  if (options.delta) return { deltaX: options.delta.x ?? 0, deltaY: options.delta.y ?? 0, times };
  const steps = {
    up: [0, -100],
    down: [0, 100],
    left: [-100, 0],
    right: [100, 0],
  } as const;
  const [deltaX, deltaY] = steps[options.direction];
  return { deltaX, deltaY, times };
}

/**
 * The part of a locator under the view's root (`getByRole('button', { name: '+3' })`), which a
 * step's action names on every target. Refuses anything else: an element (its selector would be
 * built from the DOM, which differs by target), the root itself, a locator of the page or of
 * another view, whose root's number depends on the mount order.
 */
function underRoot(testId: string, target: unknown, kind: string): string {
  const serialized =
    typeof target === "object" && target !== null && "serialize" in target
      ? (target as Locator).serialize().locator
      : undefined;
  const prefix = `getByTestId('${testId}').`;
  if (serialized === undefined || !serialized.startsWith(prefix)) {
    throw new TypeError(
      `view.user.${kind}: act on a locator of this view, such as view.getByRole("button", { name: "Save" }), not ${serialized === undefined ? "an element" : serialized}: a step names its target the same way on every target.`,
    );
  }
  return serialized.slice(prefix.length);
}

/** An options object, or nothing when it has no options set. */
function nonEmpty(options: object | undefined): object | undefined {
  return options && Object.keys(options).length ? options : undefined;
}
