import { type ComponentProps, type JSX, createMemo, createSignal, splitProps } from "solid-js";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

export default function Glossary(
  props: GlossaryProps &
    Omit<ComponentProps<"section">, "terms" | "definitions" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["terms", "definitions", "class"]);

  const [index, setIndex] = createSignal(0);
  const definition = createMemo(() => props.definitions[index()] ?? "");

  function next() {
    setIndex((index() + 1) % props.terms.length);
  }

  return (
    <section
      class={props.class ? `glossary ${props.class}` : "glossary"}
      aria-label="Glossary"
      {...others}
    >
      <h2>{props.terms[index()]}</h2>
      <div class="definition" innerHTML={definition()} />
      <button type="button" onClick={next}>
        Next term
      </button>
    </section>
  );
}
