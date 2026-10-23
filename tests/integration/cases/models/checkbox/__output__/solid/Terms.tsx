import { type JSX, createSignal } from "solid-js";

export default function Terms(props: { class?: string; style?: JSX.CSSProperties }) {
  const [agreed, setAgreed] = createSignal(false);

  return (
    <section aria-label="Terms" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <label>
        <input
          type="checkbox"
          checked={agreed()}
          onChange={(event) => setAgreed(event.currentTarget.checked)}
        />{" "}
        I agree
      </label>
      <output>{agreed() ? "Agreed" : "Not agreed"}</output>
      <button type="button" onClick={() => setAgreed(!agreed())}>
        Toggle
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
