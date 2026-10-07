import {
  For,
  createReaction,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";

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

function isAnswer(value: string): value is "yes" | "no" {
  return value === "yes" || value === "no";
}

export default function Ballot(rawProps: BallotProps & BallotEvents) {
  const props = mergeProps({ label: "Vote" } satisfies Partial<BallotProps>, rawProps);
  const [votes, setVotes] = createSignal(untrack(() => props.limit));
  const [picked, setPicked] = createSignal("none");
  let remaining = untrack(() => props.limit);
  let text = untrack(() => `${props.label} (${props.limit})`);
  let lastVotes = untrack(() => votes());

  function describe(): string {
    const line = `${picked()} with ${votes()} left`;
    return line;
  }

  createWatchEffect([picked, votes], () => {
    props.onReport?.(describe());
  });

  createWatcher(
    [votes, picked],
    ([nextVotes, nextPicked]: [number, string], [lastCount, lastPick]) => {
      props.onMoved?.(`${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
    },
  );

  function vote(choice: string) {
    if (remaining > 0) remaining -= 1;
    text = `${text}!`;
    lastVotes = votes();
    setVotes(votes() - 1);
    setPicked(isAnswer(choice) ? choice : "other");
    props.onVoted?.(remaining, `${text} ${lastVotes}`);
  }

  function count() {
    let answers = 0;
    props.choices.forEach((choice) => isAnswer(choice) && answers++);
    props.onCounted?.(answers);
  }

  return (
    <section class="ballot" aria-label={props.label}>
      <p role="status">{votes()} votes left</p>
      <p>Picked: {picked()}</p>
      <ul aria-label="Choices">
        <For each={props.choices}>
          {(choice) => (
            <li>
              <button type="button" onClick={() => vote(choice)}>
                {choice}
              </button>
            </li>
          )}
        </For>
      </ul>
      <button type="button" onClick={count}>
        Count the answers
      </button>
    </section>
  );
}

/**
 * The watchers whose sources have changed since the last flush, in the order they changed: those
 * that run before the DOM updates, and those that run after it.
 */
const queuedWatchers = { pre: new Set<() => void>(), post: new Set<() => void>() };
let flushQueued = false;

/**
 * Vue's scheduler: queues a watcher whose sources have changed and, once the synchronous code that
 * changed them has finished, runs each queued watcher once, those that run before the DOM updates
 * first, until none is queued. Solid updates the DOM as each write is made, so a watcher that runs
 * after the DOM updates sees what the others wrote.
 */
function queueWatcher(queue: Set<() => void>, run: () => void): void {
  queue.add(run);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      do {
        for (const watcher of queuedWatchers.pre) {
          queuedWatchers.pre.delete(watcher);
          watcher();
        }
        for (const watcher of queuedWatchers.post) {
          queuedWatchers.post.delete(watcher);
          watcher();
          if (queuedWatchers.pre.size) break;
        }
      } while (queuedWatchers.pre.size || queuedWatchers.post.size);
    } finally {
      flushQueued = false;
    }
  });
}

/**
 * Vue's `watch`: once a value `sources` read has changed (by `Object.is`), calls `callback` back
 * when the code that changed it has finished, before the DOM updates (after it, with `flush:
 * "post"`), with the value at its last callback and a cleanup registrar, whose cleanups run before
 * the next callback and when the component is removed.
 */
function createWatcher<const S extends readonly (() => unknown)[]>(
  sources: S,
  callback: (
    values: WatchedValues<S>,
    previous: WatchedValues<S>,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options?: { flush: "post" },
): void;
function createWatcher(
  sources: readonly (() => unknown)[],
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { flush: "post" },
): void {
  const cleanups: (() => void)[] = [];
  const queue = options?.flush === "post" ? queuedWatchers.post : queuedWatchers.pre;
  const track = createReaction(() => queueWatcher(queue, run));
  let last = read();
  onMount(() =>
    onCleanup(() => {
      queue.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
    }),
  );

  function read(): unknown[] {
    let values: unknown[] = [];
    track(() => {
      values = sources.map((each) => each());
    });
    return values;
  }

  function run(): void {
    const values = read();
    if (values.every((value, index) => Object.is(value, last[index]))) return;
    const previous = last;
    last = values;
    call(values, previous);
  }

  function call(values: unknown[], previous: unknown[] | undefined): void {
    for (const cleanup of cleanups.splice(0)) cleanup();
    const register = (cleanup: () => void) => cleanups.push(cleanup);
    callback(values as never, (previous ?? []) as never, register);
  }
}

/**
 * Vue's `watchEffect` over the values it reads (`sources`): runs `effect` once the component has
 * mounted, then again after the DOM updates once one of them has been written, with a cleanup
 * registrar, whose cleanups run before its next run and when the component is removed.
 */
function createWatchEffect(
  sources: readonly (() => unknown)[],
  effect: (onCleanup: (cleanup: () => void) => void) => unknown,
): void {
  onMount(() => {
    const cleanups: (() => void)[] = [];
    const track = createReaction(() => queueWatcher(queuedWatchers.post, run));
    run();
    onCleanup(() => {
      queuedWatchers.post.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
    });

    function run(): void {
      track(() => {
        for (const source of sources) source();
      });
      for (const cleanup of cleanups.splice(0)) cleanup();
      effect((cleanup) => cleanups.push(cleanup));
    }
  });
}

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };
