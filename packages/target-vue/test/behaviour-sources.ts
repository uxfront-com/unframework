// The sources the behaviour tests (behaviour.browser.test.ts, setup.test.ts) compile through this
// target, each a small component around one rule of the semantics contract (ADR-0045 to
// ADR-0049) that the corpus relies on Vue to keep: reads after writes, watch timing, previous
// values and cleanup, lifecycle, template refs, ids, listeners with their options, and emits.

/** Component name → its `.uf.tsx` source. */
export const BEHAVIOUR_SOURCES: Readonly<Record<string, string>> = {
  // Reads after writes in one handler, a computed read right after a write, and a read after
  // `await nextTick()`, which sees the DOM updated.
  Tally: `import { computed, defineEmits, nextTick, ref, useTemplateRef } from "unframework";

export default function Tally() {
  const emit = defineEmits<{ report: [label: string, value: number] }>();

  const count = ref(0);
  const doubled = computed(() => count.value * 2);
  const shown = useTemplateRef<HTMLOutputElement>();

  function addTwice() {
    count.value++;
    count.value++;
    emit("report", "count", count.value);
    emit("report", "doubled", doubled.value);
  }

  async function addLater() {
    count.value += 1;
    await nextTick();
    emit("report", "rendered", Number(shown.value?.textContent ?? "-1"));
    count.value += 1;
    emit("report", "after await", count.value);
  }

  return (
    <div>
      <output ref={shown}>{count.value}</output>
      <button type="button" onClick={addTwice}>
        Add two
      </button>
      <button type="button" onClick={addLater}>
        Add later
      </button>
    </div>
  );
}
`,
  // Watchers: one callback per handler for two writes, the previous value at the last callback,
  // the cleanup before the next callback and at unmount, an array source, an immediate getter
  // that runs during setup, a post watcher that reads the updated DOM, and \`watchEffect\` after
  // the first render.
  Watchers: `import { defineEmits, ref, useTemplateRef, watch, watchEffect } from "unframework";

export default function Watchers() {
  const emit = defineEmits<{
    counted: [value: number, previous: number];
    cleanup: [value: number];
    pair: [first: number, second: number];
    parity: [even: boolean];
    items: [count: number];
    effect: [value: number];
  }>();

  const count = ref(0);
  const other = ref(0);
  const list = useTemplateRef<HTMLUListElement>();

  watch(count, (value, previous, onCleanup) => {
    emit("counted", value, previous);
    onCleanup(() => {
      emit("cleanup", value);
    });
  });

  watch([count, other], ([first, second]) => {
    emit("pair", first, second);
  });

  watch(
    () => count.value % 2 === 0,
    (even) => {
      emit("parity", even);
    },
    { immediate: true },
  );

  watch(
    count,
    () => {
      emit("items", list.value?.childElementCount ?? -1);
    },
    { flush: "post" },
  );

  watchEffect(() => {
    emit("effect", count.value);
  });

  function addTwice() {
    count.value += 1;
    count.value += 1;
  }

  function touchOther() {
    other.value += 1;
  }

  return (
    <div>
      <ul ref={list}>
        {Array.from({ length: count.value }, (_, position) => position).map((index) => (
          <li key={index}>{index}</li>
        ))}
      </ul>
      <button type="button" onClick={addTwice}>
        Add two
      </button>
      <button type="button" onClick={touchOther}>
        Touch other
      </button>
    </div>
  );
}
`,
  // Lifecycle: \`onMounted\` once the component's DOM is in the document, \`onUnmounted\` when it
  // is removed; a timer a setup \`let\` holds stops at unmount.
  Lifecycle: `import { defineEmits, onMounted, onUnmounted, useTemplateRef } from "unframework";

export interface LifecycleProps {
  interval: number;
}

export default function Lifecycle({ interval }: LifecycleProps) {
  const emit = defineEmits<{ mounted: [connected: boolean]; ticked: [count: number]; unmounted: [] }>();

  const root = useTemplateRef<HTMLDivElement>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticks = 0;

  function tick() {
    ticks += 1;
    emit("ticked", ticks);
  }

  onMounted(() => {
    emit("mounted", root.value?.isConnected ?? false);
    timer = setInterval(tick, interval);
  });

  onUnmounted(() => {
    clearInterval(timer);
    emit("unmounted");
  });

  return <div ref={root}>Ticking</div>;
}
`,
  // Listeners with options and modifiers: a capture listener before the target's and a bubble
  // one after, \`stopPropagation()\` at the start of a handler (Vue's \`.stop\`), a once listener, a
  // passive wheel listener, a handler the template cannot hold, and an arrow reading its event.
  Listeners: `import { defineEmits, ref } from "unframework";

export default function Listeners() {
  const emit = defineEmits<{ logged: [entries: string[]] }>();

  const log = ref<string[]>([]);
  const wheel = ref(0);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function onWheel(event: WheelEvent) {
    wheel.value += event.deltaY > 0 ? 1 : -1;
  }

  return (
    <section>
      <div
        role="presentation"
        onClickCapture={() => record("capture")}
        onClick={() => record("bubble")}
      >
        <button type="button" onClick={() => record("target")}>
          Inside
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop
        </button>
      </div>
      <button type="button" onClickOnce={() => record("once")}>
        Once
      </button>
      <button
        type="button"
        value="named"
        onClick={(event) => record((event.currentTarget as HTMLButtonElement).value)}
      >
        Read the event
      </button>
      <button
        type="button"
        onClick={() => {
          record("hoisted");
          emit("logged", log.value);
        }}
      >
        Report
      </button>
      <div role="group" aria-label="Wheel" onWheelPassive={onWheel}>
        <output>{wheel.value}</output>
      </div>
      <p>{log.value.join(", ")}</p>
    </section>
  );
}
`,
  // Template refs keyed by their binding's name, empty while their element is not rendered, and
  // ids unique to each instance, with the \`uf-id-\` prefix.
  Refs: `import { defineEmits, nextTick, ref, useId, useTemplateRef } from "unframework";

export default function Refs() {
  const emit = defineEmits<{ present: [present: boolean]; focused: [id: string] }>();

  const shown = ref(true);
  const field = useTemplateRef<HTMLInputElement>();
  const fieldId = useId();

  async function toggle() {
    shown.value = !shown.value;
    await nextTick();
    emit("present", field.value?.isConnected ?? false);
  }

  function focusField() {
    field.value?.focus();
    emit("focused", fieldId);
  }

  return (
    <div>
      {shown.value && (
        <label for={fieldId}>
          Name
          <input id={fieldId} ref={field} />
        </label>
      )}
      <button type="button" onClick={toggle}>
        Toggle
      </button>
      <button type="button" onClick={focusField}>
        Focus
      </button>
    </div>
  );
}
`,

  // State that holds an object is the source's own value, never a proxy of it: identity with a
  // prop's item and \`structuredClone\` hold, and an array watcher over it calls back only when a
  // value changed (ADR-0046, ADR-0048).
  Identity: `import { defineEmits, ref, watch } from "unframework";

export interface Fruit {
  id: string;
  name: string;
}

export default function Identity({ fruits }: { fruits: Fruit[] }) {
  const emit = defineEmits<{
    same: [same: boolean];
    cloned: [text: string];
    moved: [picks: number, many: boolean];
  }>();

  const selected = ref<Fruit | null>(null);
  const draft = ref({ size: "M", color: "red" });
  const picks = ref<string[]>([]);
  const count = ref(0);

  watch([picks, () => count.value > 1], ([list, many]) => {
    emit("moved", list.length, many);
  });

  function pick(fruit: Fruit) {
    selected.value = fruit;
    picks.value = [...picks.value, fruit.id];
    emit("same", selected.value === fruit);
  }

  function clone() {
    const copy = structuredClone(draft.value);
    emit("cloned", \`\${copy.size} \${copy.color}\`);
  }

  return (
    <div>
      <ul>
        {fruits.map((fruit) => (
          <li key={fruit.id}>
            <button type="button" aria-pressed={fruit === selected.value} onClick={() => pick(fruit)}>
              {fruit.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={clone}>
        Clone
      </button>
      <button type="button" onClick={() => count.value++}>
        Count
      </button>
    </div>
  );
}
`,
  Reselect: `import { defineEmits, ref, watch } from "unframework";

export interface Fruit {
  id: string;
  name: string;
}

export default function Reselect({ fruits }: { fruits: Fruit[] }) {
  const emit = defineEmits<{ chosen: [name: string]; counted: [text: string] }>();

  const selected = ref<Fruit | null>(null);
  const counts = ref(new Map<string, number>());

  watch(selected, (fruit) => emit("chosen", fruit ? fruit.name : "none"));
  watch(counts, (next) => emit("counted", [...next.keys()].join(",")));

  function choose(fruit: Fruit) {
    selected.value = null;
    selected.value = fruit;
  }

  function recount() {
    const before = counts.value;
    counts.value = new Map();
    counts.value = before;
  }

  return (
    <div>
      {fruits.map((fruit) => (
        <button key={fruit.id} type="button" onClick={() => choose(fruit)}>
          {fruit.name}
        </button>
      ))}
      <button type="button" onClick={recount}>
        Recount
      </button>
    </div>
  );
}
`,
};
