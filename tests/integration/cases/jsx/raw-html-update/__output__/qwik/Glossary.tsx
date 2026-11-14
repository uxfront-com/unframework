import {
  $,
  type CSSProperties,
  type ClassList,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

export default component$<GlossaryProps & { class?: ClassList; style?: CSSProperties }>(
  ({ terms, definitions, class: className, style, ...attributes }) => {
    const index = useSignal(0);
    const definition = useComputed$(() => definitions[index.value] ?? "");

    const next = $(() => {
      index.value = (index.value + 1) % terms.length;
    });

    return (
      <section
        class={["glossary", className]}
        aria-label="Glossary"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2>{terms[index.value]}</h2>
        <div class="definition" dangerouslySetInnerHTML={definition.value || undefined} />
        <button type="button" onClick$={next}>
          Next term
        </button>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
