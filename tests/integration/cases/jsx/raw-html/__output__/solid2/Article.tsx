import type { JSX } from "@solidjs/web";

export interface ArticleProps {
  title: string;
  body: string;
}

export default function Article(
  props: ArticleProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `article ${props.class}` : "article"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.title}</h2>
      <div class="body" innerHTML={props.body} />
      <footer innerHTML={"<small>Filed under <em>News</em></small>"} />
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
