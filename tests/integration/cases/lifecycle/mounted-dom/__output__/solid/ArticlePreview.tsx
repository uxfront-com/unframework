import { createSignal, onCleanup, onMount } from "solid-js";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export interface ArticlePreviewEvents {
  onReady?: (characters: number) => void;
}

export default function ArticlePreview(props: ArticlePreviewProps & ArticlePreviewEvents) {
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
    <article class="article-preview" aria-label={props.title}>
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
