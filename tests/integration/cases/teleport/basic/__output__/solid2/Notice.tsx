import { type JSX, Portal } from "@solidjs/web";
import { Show, createSignal, flush, getObserver, onSettled, untrack } from "solid-js";

export interface NoticeProps {
  message: string;
}

export default function Notice(props: NoticeProps & { class?: string; style?: JSX.CSSProperties }) {
  const [dismissed, setDismissed] = createState(0);

  return (
    <section
      class={props.class ? `inbox ${props.class}` : "inbox"}
      aria-label="Inbox"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p>Dismissed {dismissed()} times</p>
      <Teleport to="body">
        <div data-teleported="true" class="notice">
          <p role="status">
            {props.message} ({dismissed()})
          </p>
          <button type="button" onClick={() => setDismissed(dismissed() + 1)}>
            Dismiss
          </button>
        </div>
      </Teleport>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** The teleports rendered and not yet mounted, in the order they rendered. */
const TeleportQueue: (() => void)[] = [];

/** Mounts `children` into the element `to` selects once the component has mounted, and removes them with it. */
function Teleport(props: { to: string; children: JSX.Element }): JSX.Element {
  const [target, setTarget] = createSignal<Element | null>(null);
  // Where it mounts is read once, as it mounts.
  const to = untrack(() => props.to);
  TeleportQueue.push(() => setTarget(document.querySelector(to)));
  onSettled(() => {
    if (TeleportQueue.length) {
      queueMicrotask(() => {
        for (const mount of TeleportQueue.splice(0)) {
          mount();
          flush();
        }
      });
    }
  });
  return (
    <Show when={target()}>{(mount) => <Portal mount={mount()}>{props.children}</Portal>}</Show>
  );
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
