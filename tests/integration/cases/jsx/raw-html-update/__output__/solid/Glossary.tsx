import { type JSX, createMemo, createSignal } from "solid-js";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

export default function Glossary(
  props: GlossaryProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [index, setIndex] = createSignal(0);
  const definition = createMemo(() => props.definitions[index()] ?? "");

  function next() {
    setIndex((index() + 1) % props.terms.length);
  }

  return (
    <section
      class={props.class ? `glossary ${props.class}` : "glossary"}
      aria-label="Glossary"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.terms[index()]}</h2>
      <div class="definition" innerHTML={definition()} />
      <button type="button" onClick={next}>
        Next term
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
