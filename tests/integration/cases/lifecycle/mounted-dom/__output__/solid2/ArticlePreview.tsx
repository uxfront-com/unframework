import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, onSettled } from "solid-js";

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
    Omit<ComponentProps<"article">, "title" | "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "text", "onReady", "class");

  let body: HTMLParagraphElement | null = null;
  const [characters, setCharacters] = createState(0);
  const [counted, setCounted] = createState(false);

  onSettled(() => {
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
        ref={clearedRef(
          (element) => {
            body = element;
          },
          () => {
            body = null;
          },
        )}
      >
        {props.text}
      </p>
      <p role="status">{counted() ? `${characters()} characters` : "Counting the characters"}</p>
    </article>
  );
}
