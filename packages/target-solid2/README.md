# @unframework.dev/target-solid2

The Solid 2 target of the Unframework compiler, selected as `solid@2` (ADR-0102): one function
component in TSX per source component, written as a Solid 2 developer would write it (plan §6).
It is a fork of `@unframework.dev/target-solid`, the Solid 1.9 target, moved to Solid 2's API.
`solid` and `solid@1` still select Solid 1, and the default targets leave `solid@2` out: a project
opts in.

```tsx
import type { JSX } from "@solidjs/web";
import { Show, merge, untrack } from "solid-js";

import { createState } from "./_unframework/createState";
import { scopeAttributes } from "./_unframework/scopeAttributes";

export interface CounterProps {
	initial?: number;
	step?: number;
}

export interface CounterEvents {
	onChange?: (value: number) => void;
}

export default function Counter(
	rawProps: CounterProps & CounterEvents & { class?: string; style?: JSX.CSSProperties },
) {
	const props = merge(rawProps, {
		get initial() {
			return rawProps.initial === undefined ? 0 : rawProps.initial;
		},
		get step() {
			return rawProps.step === undefined ? 1 : rawProps.step;
		},
	});
	const [count, setCount] = createState(untrack(() => props.initial));
	const doubled = () => count() * 2;

	function increment() {
		setCount(count() + props.step);
		props.onChange?.(count());
	}

	return (
		<div
			class={props.class ? `counter ${props.class}` : "counter"}
			style={props.style}
			{...scopeAttributes(props)}
		>
			<output>{count()}</output>
			<Show when={doubled() > 10}>
				<span>Big</span>
			</Show>
			<button type="button" onClick={increment}>
				+{props.step}
			</button>
		</div>
	);
}
```

`createState` and `scopeAttributes` are shared helpers, modules of their own in the tree's
`_unframework/` (ADR-0121).

## Where it differs from Solid 1

Everything `@unframework.dev/target-solid`'s README says holds here, but for what Solid 2 changed
(ADR-0102):

- **State.** Solid 2 lets a read see a write only once it flushes, on a microtask or at
  `flush()`, which an effect's callback or `onSettled` cannot call. Vue's read sees a write at
  once. So `ref` goes through a helper, `createState`: a signal that holds a version, whose
  read returns the value last written and tracks the signal where something observes it. It is
  shared in the tree's `_unframework/` (ADR-0121), but in a component with watchers, whose
  `createState` queues their flush at the write and stays inline. Solid
  applies what a write changes, the DOM included, when it flushes. A derived value is a function,
  `const doubled = () => count() * 2`, which reads the latest values too
  (`interactivity`, emulated).
- **Watchers.** `createWatcher` and `createWatchEffect` keep Solid 1's scheduler, with two
  changes: a write of `createState` queues the scheduler's flush at the write, as Vue's is queued,
  and the flush calls `flush()` before the watchers that run before the DOM updates and again
  before those that run after it. Their reactions live in roots of their own, apart from the
  component's owner: Solid's server creates none, and one among the component's children would
  shift the hydration keys of what the client renders after it.
- **`isDev`.** It comes from `@solidjs/web`, where Solid 2 exports it, not from `solid-js/web`
  (ADR-0117).
- **Hooks.** `onMounted` is `onSettled` with a block body, and `onUnmounted` is the cleanup an
  `onSettled` returns. Solid 2 refuses any other value an `onSettled` callback returns.
- **Props.** Defaults are getters in `merge`, `get step() { return rawProps.step === undefined ? 1
  : rawProps.step; }`: Solid 2's `merge` takes a prop passed as `undefined` for a value.
- **Context.** A key is `createContext<T | null>(null)`, its own provider, `<Key value={…}>`, and
  `inject` is `useContext(Key) ?? fallback`, or `?? undefined`: Solid 2's context without a
  default throws where nothing provides it.
- **Async setup.** One async `createMemo` runs the awaits, and the rest of the setup renders in a
  keyed `<Show>` under `<Loading>`. The hydrate adapter runs the scripts the server render writes,
  since Solid 2 hydrates the subtree in place only with the values the server awaited.
- **Elements.** Static names and toggles print as Solid 2's `class` array, which replaces
  `classList`. A boolean of an enumerated attribute (ARIA's, `draggable`, `spellcheck`,
  `contenteditable`) goes through `enumeratedValue`, which writes `"true"` or `"false"` as Vue
  does, where Solid 2 writes the attribute's presence. A `<textarea>`'s `value` is its text on the
  server too.
- **Listeners and refs.** Solid 2 has no `on:` namespace, so a listener with an option, and every
  native one of a delegated event, is added from the element's `ref`. Solid 2 refuses
  `onCleanup` and creates no computation in a `ref` callback, so a template ref goes through
  `clearedRef`, `modelText` and `selectOptions` are factories that return the callback, and an
  element with several is `ref={[…]}`. A directive's factory runs on the server too, where its
  primitives only take their hydration keys.
- **Fallthrough (ADR-0118).** Solid 2 has no `splitProps`: `const others = omit(props, "title")`
  leaves the declared names out of what the root spreads. Where the props' rest is spread on an
  element other than the root, `omit` leaves the styled parents' scope attributes out of it by
  rule, `omit(omit(props, "label", "ref"), (name) => String(name).startsWith("data-uf-"))`, with
  no helper. An element's `class` is typed a string, since Solid 2 types it any `ClassValue`,
  which the root merges as one string. A root with a `ref` of its own and the consumer's takes
  them as one `ref` array, and a ref on a child that exposes nothing goes through `clearedRef`:
  the child's spread hands it the element from a `ref` callback.
- **Teleport and transition.** `Teleport` renders Solid 2's `<Portal>`, which inserts no wrapper,
  once the component has mounted, the teleports in the order they rendered. `Transition` resolves
  its child on the server too.
- **Shared helpers (ADR-0121).** `_unframework/` holds Solid 1's shared helpers but `Teleport`,
  and `createState.ts`, `enumeratedValue.ts` and `clearedRef.ts` beside them. `Teleport` stays
  inline, since its queue of the teleports that rendered lives in the module. So does the
  `createState` of a component with watchers, whose write queues their flush, under a name past
  the shared one's where the component's source has others.

## Toolchain

The tests and tooling build, check and run Solid 2 output through four entries. Solid 2, its
compiler and its Vite plugin load from `context.toolchainDir`, as Angular's compiler stack does:
`tests/toolchains/solid2` in this repository, which is the only place Solid 2 is installed for
the corpus, and the project root, or `package.resolveFrom.solid2`, in a project (ADR-0102).

- `@unframework.dev/target-solid2/toolchain` (Node): the Vite configuration of browser, SSR and
  hydrate projects. It loads `@solidjs/vite-plugin` from the toolchain directory, with `ssr` and
  `hydratable` for SSR and hydrate projects and no refresh, and adds `resolveSolid`, a `pre`
  plugin that resolves `solid-js` and `@solidjs/web` as the toolchain directory would, through
  Vite's own resolution, so each environment's conditions apply. It keeps Solid out of the
  dependency optimizer, which resolves from the project root past every plugin, and out of the
  plugin's dedupe, which would too. The framework compile check (L3) runs `@solidjs/compiler`, the
  one the Vite plugin runs, in `dom` and hydratable `ssr` modes, where a parse error and a template
  a browser would parse differently are errors. The type check (L4) is one TypeScript 7 run over
  all files against `tests/toolchains/solid2/tsconfig.json`, whose `paths` map Solid's packages to
  that directory's copy. The lint (L5) is oxlint with the shared baseline and eslint-plugin-solid's
  v2-strict rules (`tests/toolchains/solid2/output.oxlintrc.json`).
- `@unframework.dev/target-solid2/toolchain/client` (browser): mounts with `render` and flushes.
  Its props are a proxy with a signal per key, and a rerender writes them and flushes.
- `@unframework.dev/target-solid2/toolchain/hydrate` (browser, L12, ADR-0095): runs the server
  render's scripts, then hydrates with `hydrate` from a fresh `_$HY`.
- `@unframework.dev/target-solid2/toolchain/server` (Node): renders with `renderToStream`, awaited,
  which waits for every `<Loading>`, with `noScripts` for L6 and with Solid's scripts for the HTML
  the hydrate adapter hydrates.

Each adapter throws as it loads if `solid-js` is Solid 1 ("the solid2 project loaded Solid 1"),
and each mounts and unmounts after reviving Solid's scheduler, which an error nothing caught
stops for the whole page (`sourcemaps/computed-throws` throws one on purpose).
`test/resolve.test.ts` pins where the fragment resolves Solid 2.
