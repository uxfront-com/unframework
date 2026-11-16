import { vRecord } from "./vRecord";
import { type JSX, createSignal } from "solid-js";

export default function Meter(props: { class?: string; style?: JSX.CSSProperties }) {
  const [level, setLevel] = createSignal(1);
  const [renders, setRenders] = createSignal(0);

  return (
    <section
      class={props.class ? `meter ${props.class}` : "meter"}
      aria-label="Meter"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <output class="level" ref={vRecord(() => level())}>
        Level {level()}
      </output>
      <p>Rendered again {renders()} times</p>
      <button type="button" onClick={() => setLevel(level() + 1)}>
        Raise
      </button>
      <button type="button" onClick={() => setRenders(renders() + 1)}>
        Render again
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
