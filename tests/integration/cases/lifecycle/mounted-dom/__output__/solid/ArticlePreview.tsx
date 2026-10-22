import { type JSX, createSignal, onCleanup, onMount } from "solid-js";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export interface ArticlePreviewEvents {
  onReady?: (characters: number) => void;
}

export default function ArticlePreview(
  props: ArticlePreviewProps & ArticlePreviewEvents & { class?: string; style?: JSX.CSSProperties },
) {
  let body: HTMLParagraphElement | null = null;
  const [characters, setCharacters] = createSignal(0);
  const [counted, setCounted] = createSignal(false);

  onMount(() => {
    const length = body?.textContent?.length ?? 0;
    setCharacters(length);
    setCounted(true);
    props.onReady?.(length);
  });

  return (
    <article
      class={props.class ? `article-preview ${props.class}` : "article-preview"}
      aria-label={props.title}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.title}</h2>
      <p
        ref={(element) => {
          body = element;
          onCleanup(() => {
            body = null;
          });
        }}
      >
        {props.text}
      </p>
      <p role="status">{counted() ? `${characters()} characters` : "Counting the characters"}</p>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
