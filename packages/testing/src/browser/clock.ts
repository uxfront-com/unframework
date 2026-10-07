// `view.clock` (ADR-0050): a deterministic clock for a component's intervals. A real interval
// fires whenever the page lets it: under load a tick lands inside an action's step on one target
// and after it on another, and their traces differ. A view mounted with `{ clock: true }` runs on
// Vitest's fake `setInterval` and `clearInterval`, installed before the component mounts, so its
// intervals fire only when the spec advances the clock, inside a step of their own. A tick runs
// the intervals due one at a time and settles the framework after each, as the time between two
// intervals would let it: React, Angular and Qwik render in a task of their own, and intervals
// run back to back would write twice before they render once.
//
// Only those two are faked, because no framework schedules with them: React's scheduler posts
// MessageChannel tasks, Vue and Svelte queue microtasks, Solid updates synchronously and posts
// MessageChannel tasks for deferred work, Angular's zoneless scheduler races a `setTimeout`
// against a frame, and Qwik queues microtasks and MessageChannel tasks; none of their runtimes
// calls `setInterval`. Vitest's own waits keep the timers it saved at startup, and `Date`,
// `performance`, `setTimeout` and the frames stay real.
import { vi } from "vitest";

/** The page's fake clock, as a view mounted with `{ clock: true }` advances it. */
export interface ViewClock {
  /**
   * Advances the clock by `ms` milliseconds (a positive whole number) and runs every interval
   * due on the way, one at a time, as real time would: each in a task of its own, through the
   * adapter's `interact`, then settled as a `view.user` action is before the next is due, so a
   * framework renders between two intervals. Intervals due at the same moment run one after
   * another, settled between them. The tick is recorded as one step of the trace, `tick <ms>ms`,
   * which holds the events every interval emitted. After the unmount there is no DOM left to
   * record: it advances the clock the same way, settling the page after each interval, records
   * no step, and `emitted` shows what an interval the component failed to stop emitted. It
   * throws for a view mounted without a clock, and on a target that runs no client code.
   */
  tick(ms: number): Promise<void>;
}

/** Whether a view of the current test has installed the clock. */
let installed = false;

/**
 * Fakes the page's intervals before a view's component mounts. The clock is the page's, so one
 * view of a test may have it: a tick would run every view's intervals, and a step records one.
 */
export function installClock(): void {
  if (installed) {
    throw new Error(
      "mount: a view of this test has a clock already. The clock is the page's, so one view of a test runs on it: a tick runs every view's intervals, but records a step of one view's trace.",
    );
  }
  // A native interval started before the clock (Vite's client pings its server) and cleared
  // while it runs reaches the native `clearInterval`, rather than a warning L13 would catch.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"], shouldClearNativeTimers: true });
  installed = true;
}

/** What a tick reads of the clock Vitest's fake timers install (`@sinonjs/fake-timers`). */
interface FakeClock {
  now: number;
  /** The scheduled timers by id: a `Map`, or an object in older versions; absent before any. */
  timers?: Map<unknown, { callAt: number }> | Record<string, { callAt: number }>;
  /** Runs the first timer due, alone, in a native task, and resolves in the next one. */
  nextAsync(): Promise<number>;
  /** Advances the clock, running the timers due on the way. */
  tickAsync(ms: number): Promise<number>;
}

/** The fake clock behind the page's `setInterval`, which keeps it as its `clock`. */
function fakeClock(): FakeClock {
  const clock = (globalThis.setInterval as { clock?: Partial<FakeClock> }).clock;
  if (
    typeof clock?.now !== "number" ||
    typeof clock.nextAsync !== "function" ||
    typeof clock.tickAsync !== "function"
  ) {
    throw new Error(
      "view.clock.tick: the page's setInterval is not a fake clock the tick can read (its `clock`, with `now`, `nextAsync` and `tickAsync`): Vitest's fake timers changed.",
    );
  }
  return clock as FakeClock;
}

/** When the first timer is due, or nothing when none is scheduled. */
function firstDue(clock: FakeClock): number | undefined {
  const { timers } = clock;
  const scheduled = timers instanceof Map ? [...timers.values()] : Object.values(timers ?? {});
  let first: number | undefined;
  for (const { callAt } of scheduled) {
    if (typeof callAt !== "number") {
      throw new Error(
        "view.clock.tick: a fake timer has no due time (`callAt`): Vitest's fake timers changed.",
      );
    }
    if (first === undefined || callAt < first) first = callAt;
  }
  return first;
}

/**
 * Advances the clock by `ms` milliseconds, one due interval at a time: `run` gets each one to
 * fire, in a native task of its own, and settles what it did before the next is due. An
 * interval a callback starts or restarts is due on the way too, if its time comes before the
 * end. Then the clock moves on to the end, where no interval is due.
 */
export async function advanceClock(
  ms: number,
  run: (fire: () => Promise<void>) => Promise<void>,
): Promise<void> {
  const clock = fakeClock();
  const end = clock.now + ms;
  let fired = 0;
  for (let due = firstDue(clock); due !== undefined && due <= end; due = firstDue(clock)) {
    // The fake timers' own limit on the timers one advance runs (`loopLimit`).
    if ((fired += 1) > MAX_INTERVALS) {
      throw new Error(
        `view.clock.tick: more than ${MAX_INTERVALS} intervals were due in ${ms}ms: an interval of no time, or one restarted from its own callback, never lets the clock reach the end.`,
      );
    }
    await run(async () => {
      await clock.nextAsync();
    });
  }
  if (clock.now < end) await clock.tickAsync(end - clock.now);
}

/** The most intervals one tick runs, as Vitest's fake timers bound one advance (`loopLimit`). */
const MAX_INTERVALS = 1000;

/**
 * Gives the page its real intervals back. The setup calls it when a test ends, after the
 * unmount, so a component's teardown clears its interval on the clock that set it.
 */
export function restoreClock(): void {
  if (!installed) return;
  installed = false;
  vi.useRealTimers();
}

/** Refuses a tick that is not a positive whole number of milliseconds. */
export function checkTick(ms: unknown): void {
  if (typeof ms === "number" && Number.isSafeInteger(ms) && ms > 0) return;
  throw new TypeError(
    `view.clock.tick: the time to advance is a positive whole number of milliseconds, not ${typeof ms === "number" ? String(ms) : typeof ms}.`,
  );
}
