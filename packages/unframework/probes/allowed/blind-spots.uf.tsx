// Mistakes stock tsgo deliberately does NOT catch. Each one is pinned here as clean code, so a change
// that starts catching it fails the suite (move it to ../caught and update the README), and each
// names the layer that does catch it.
import { computed, onMounted, ref } from "unframework";

// A stylesheet another component already owns (plan §4.4). Caught by: compiler.
import "../fixtures/Counter.css";
// A stylesheet that does not exist: the ambient `*.css` module matches any name. Caught by: compiler.
import "../fixtures/Missing.css";
import Counter from "../fixtures/Counter.uf.tsx";
import Dialog from "../fixtures/Dialog.uf.tsx";
import List from "../fixtures/List.uf.tsx";

// A CSS module: `esModuleInterop` lets a default import through. Caught by: compiler (plan §4.4).
import styles from "../fixtures/Counter.css";

function renderLabel() {
  // JSX returned from a helper (plan §4.6). Caught by: compiler.
  return <b>From a helper</b>;
}

export function BlindSpots() {
  const open = ref(false);
  const list = ref<number[]>([]);
  const form = ref({ name: "" });
  const label = <b>JSX in a variable</b>;

  return (
    <div class={styles}>
      {/* Event payload type: `next` is any. Caught by: content mapper (layer 3), outputs (layer 4). */}
      <Counter onChange={(next: string) => next.toUpperCase()} />
      {/* Unknown or misspelt event on a component. Caught by: compiler UF3xxx (layer 2). */}
      <Counter onChnage={() => {}} />
      {/* Children for a component that declares no default slot. Caught by: compiler. */}
      <Counter>Unexpected children</Counter>
      {/* Unknown model name and model type. Caught by: compiler (name), content mapper (type). */}
      <Dialog label="x" v-model:opne={open.value} v-model:open={42} />
      {/* A slot the child never declares, and slot-prop typos. Caught by: compiler (key), mapper (props). */}
      <List items={[]}>{{ footer: () => "x", item: ({ itme }) => itme }}</List>
      {/* Hyphenated names are exempt from excess-property checks in JSX (TypeScript rule).
          Caught by: compiler (aria-* against the ARIA list; v-model spellings). */}
      <div aria-hiddenn="true" v-modl={open.value} v-model_trimm={open.value} />
      {/* v-model on an element that has no value. Caught by: compiler. */}
      <div v-model={open.value} />
      {/* v-model on a non-assignable expression. Caught by: compiler (plan §4.3). */}
      <input v-model={open.value && "x"} />
      {/* Open string unions upstream declares as `... | (string & {})`. Inherited by design. */}
      <input type="definitely-not-a-type" autocomplete="nonsense" />
      {/* JSX outside the returned tree (plan §4.6). Caught by: compiler. */}
      {label}
      {renderLabel()}
      {/* In-place mutation (ADR-0008). Caught by: compiler, with a fix. */}
      <button type="button" onClick={() => list.value.push(1)}>
        Push
      </button>
      <button type="button" onClick={() => (form.value.name = "Ada")}>
        Rename
      </button>
      {/* Non-deterministic rendering (plan §4.5). Caught by: compiler. */}
      <span>{Math.random()}</span>
    </div>
  );
}

export function ConditionalReturn({ show }: { show: boolean }) {
  // An early or conditional return (plan §4.6). Caught by: compiler.
  if (!show) return null;
  return <div />;
}

export function MisplacedReactiveApis({ show }: { show: boolean }) {
  const count = ref(0);
  // A lifecycle hook inside a condition, and a reactive API inside a nested function (plan §4.6).
  // Caught by: compiler.
  if (show) onMounted(() => {});
  const later = () => computed(() => count.value * 2);
  return <output>{later().value}</output>;
}
