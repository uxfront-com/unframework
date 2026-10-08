import { Show, createSignal, createUniqueId, onCleanup, onMount } from "solid-js";

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

export default function Lifecycle(props: LifecycleProps & LifecycleEvents) {
  const id = `uf-id-${createUniqueId()}`;
  let heading: HTMLHeadingElement | null = null;
  let details: HTMLUListElement | null = null;
  const [fixed] = createSignal(format(1));
  const [open, setOpen] = createSignal(false);
  const [status, setStatus] = createSignal("idle");
  const [attempts, setAttempts] = createSignal(0);
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

  onMount(() => {
    props.onReady?.(heading?.textContent?.length ?? 0);
    timer = setInterval(tick, 20);
    headingElement = heading;
    headingElement?.addEventListener("click", tick);
  });

  onMount(() =>
    onCleanup(() => {
      clearInterval(timer);
      headingElement?.removeEventListener("click", tick);
    }),
  );

  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        ref={(element) => {
          heading = element;
          onCleanup(() => {
            heading = null;
          });
        }}
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
          ref={(element) => {
            details = element;
            onCleanup(() => {
              details = null;
            });
          }}
        >
          <li>One</li>
          <li>Two</li>
        </ul>
      </Show>
    </section>
  );
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
