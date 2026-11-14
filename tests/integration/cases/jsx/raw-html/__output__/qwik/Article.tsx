import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ArticleProps {
  title: string;
  body: string;
}

export default component$<ArticleProps & { class?: ClassList; style?: CSSProperties }>(
  ({ title, body, class: className, style, ...attributes }) => {
    return (
      <article class={["article", className]} {...scopeAttributes(attributes)} style={style}>
        <h2>{title}</h2>
        <div class="body" dangerouslySetInnerHTML={body || undefined} />
        <footer dangerouslySetInnerHTML={"<small>Filed under <em>News</em></small>"} />
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
