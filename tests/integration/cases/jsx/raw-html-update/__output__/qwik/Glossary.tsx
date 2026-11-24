import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

export default component$<
  GlossaryProps &
    Omit<PropsOf<"section">, "terms" | "definitions" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ terms, definitions, class: className, style, ...attributes }) => {
  const index = useSignal(0);
  const definition = useComputed$(() => definitions[index.value] ?? "");

  const next = $(() => {
    index.value = (index.value + 1) % terms.length;
  });

  return (
    <section class={["glossary", className]} aria-label="Glossary" style={style} {...attributes}>
      <h2>{terms[index.value]}</h2>
      <div class="definition" dangerouslySetInnerHTML={definition.value || undefined} />
      <button type="button" onClick$={next}>
        Next term
      </button>
    </section>
  );
});
