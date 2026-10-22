import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style, ...attributes }) => {
    const nested = useSignal(false);

    const Tag = nested.value ? "h3" : "h2";

    return (
      <article {...scopeAttributes(attributes)} class={className} style={style}>
        <>
          <Tag class="title">{title}</Tag>
        </>
        <button type="button" onClick$={() => (nested.value = !nested.value)}>
          {nested.value ? "Lift" : "Nest"}
        </button>
      </article>
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
