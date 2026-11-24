import {
  type ComponentProps,
  type JSX,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export interface ArticlePreviewEvents {
  onReady?: (characters: number) => void;
}

export default function ArticlePreview(
  props: ArticlePreviewProps &
    ArticlePreviewEvents &
    Omit<ComponentProps<"article">, "title" | "text" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "text", "onReady", "class"]);

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
      {...others}
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
