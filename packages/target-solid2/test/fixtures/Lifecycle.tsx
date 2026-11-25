import type { ComponentProps, JSX } from "@solidjs/web";
import {
	Show,
	createSignal,
	createUniqueId,
	getObserver,
	omit,
	onCleanup,
	onSettled,
} from "solid-js";

export interface LifecycleProps {
	title: string;
}

export interface LifecycleEvents {
	onReady?: (length: number) => void;
	onTicked?: (count: number) => void;
	onToggled?: (items: number) => void;
	onSaved?: (attempt: number, status: string) => void;
}

const units = ["s", "ms"];

function format(value: number): string {
	return `${value}${units[0]}`;
}

export default function Lifecycle(
	props: LifecycleProps &
		LifecycleEvents &
		Omit<ComponentProps<"section">, "title" | "class" | "style"> & {
			class?: string;
			style?: JSX.CSSProperties;
		},
) {
	const others = omit(props, "title", "onReady", "onTicked", "onToggled", "onSaved");

	const id = `uf-id-${createUniqueId()}`;
	let heading: HTMLHeadingElement | null = null;
	let details: HTMLUListElement | null = null;
	const [fixed] = createState(format(1));
	const [open, setOpen] = createState(false);
	const [status, setStatus] = createState("idle");
	const [attempts, setAttempts] = createState(0);
	let timer: ReturnType<typeof setInterval> | undefined;
	let ticks = 0;
	let headingElement: HTMLHeadingElement | null = null;

	function tick() {
		ticks += 1;
		props.onTicked?.(ticks);
	}

	async function toggle() {
		setOpen(!open());
		await nextTick();
		props.onToggled?.(details?.childElementCount ?? 0);
	}

	async function save() {
		setStatus("saving");
		setAttempts(attempts() + 1);
		await Promise.resolve();
		setStatus("checking");
		setAttempts(attempts() + 1);
		await nextTick();
		setStatus(`saved ${attempts()}`);
		props.onSaved?.(attempts(), status());
	}

	onSettled(() => {
		props.onReady?.(heading?.textContent?.length ?? 0);
		timer = setInterval(tick, 20);
		headingElement = heading;
		headingElement?.addEventListener("click", tick);
	});

	onSettled(() => () => {
		clearInterval(timer);
		headingElement?.removeEventListener("click", tick);
	});

	return (
		<section aria-labelledby={enumeratedValue(id)} {...others}>
			<h2
				id={id}
				ref={clearedRef(
					(element) => {
						heading = element;
					},
					() => {
						heading = null;
					},
				)}
			>
				{props.title}
			</h2>
			<p>
				{fixed()} {status()}
			</p>
			<button type="button" onClick={toggle}>
				Details
			</button>
			<button type="button" onClick={save}>
				Save
			</button>
			<Show when={open()}>
				<ul
					ref={clearedRef(
						(element) => {
							details = element;
						},
						() => {
							details = null;
						},
					)}
				>
					<li>One</li>
					<li>Two</li>
				</ul>
			</Show>
		</section>
	);
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
	return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes on a microtask
 * queued at the first write, which queues the watchers of a write the component didn't make.
 */
function nextTick(): Promise<void> {
	return new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
	onCleanup(clear);
	return callback;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
	let current = initial;
	// A version, never the value: `createSignal` would take a function for a computation.
	const [tracked, notify] = createSignal(0, { ownedWrite: true });
	function read(): T | undefined {
		if (getObserver()) tracked();
		return current;
	}
	function write(value: T | undefined): void {
		if (Object.is(value, current)) return;
		current = value;
		notify((version) => version + 1);
	}
	return [read, write];
}
