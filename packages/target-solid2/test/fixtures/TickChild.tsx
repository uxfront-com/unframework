import type { ComponentProps, JSX } from "@solidjs/web";
import { createReaction, createRoot, flush, omit, onSettled, runWithOwner } from "solid-js";

export interface TickChildEvents {
	onSeen?: (value: number) => void;
}

export function TickChild(
	props: { count: number } & TickChildEvents &
		Omit<ComponentProps<"output">, "count" | "class" | "style"> & {
			class?: string;
			style?: JSX.CSSProperties;
		},
) {
	const others = omit(props, "count", "onSeen");

	createWatcher(
		() => props.count,
		(value) => props.onSeen?.(value),
	);

	return <output {...others}>{props.count}</output>;
}

/** The watchers whose sources have changed since the last flush, in the order they changed. */
const queuedWatchers = new Set<() => void>();
let flushQueued = false;

/**
 * Vue's scheduler: queues a watcher whose sources have changed and, once the synchronous code that
 * changed them has finished, runs each queued watcher once, until none is queued: a Set's iteration
 * visits what a watcher's writes queue while it runs.
 */
function queueWatcher(run: () => void): void {
	queuedWatchers.add(run);
	requestWatcherFlush();
}

/** Queues the flush of the watchers, once, in a microtask. */
function requestWatcherFlush(): void {
	if (flushQueued) return;
	flushQueued = true;
	queueMicrotask(() => {
		try {
			flush();
			for (const watcher of queuedWatchers) {
				queuedWatchers.delete(watcher);
				watcher();
				flush();
			}
		} finally {
			flushQueued = false;
		}
	});
}

/**
 * Vue's `watch`: once the value `source` reads has changed (by `Object.is`), calls `callback` back
 * when the code that changed it has finished, before the DOM updates, with the value at its last
 * callback and a cleanup registrar, whose cleanups run before the next callback and when the
 * component is removed.
 */
function createWatcher<T>(
	source: () => T,
	callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
): void {
	const cleanups: (() => void)[] = [];
	const [track, dispose] = runWithOwner(null, () =>
		createRoot((stop) => [createReaction(() => queueWatcher(run)), stop] as const),
	);
	let last = read();
	onSettled(() => () => {
		queuedWatchers.delete(run);
		for (const cleanup of cleanups.splice(0)) cleanup();
		dispose();
	});

	function read(): T {
		let value!: T;
		track(() => {
			value = source();
		});
		return value;
	}

	function run(): void {
		const value = read();
		if (Object.is(value, last)) return;
		const previous = last;
		last = value;
		for (const cleanup of cleanups.splice(0)) cleanup();
		callback(value, previous, (cleanup) => cleanups.push(cleanup));
	}
}
