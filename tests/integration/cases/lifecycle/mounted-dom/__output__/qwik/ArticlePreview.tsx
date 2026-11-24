import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export interface ArticlePreviewEvents {
  onReady$?: QRL<(characters: number) => void>;
}

export default component$<
  ArticlePreviewProps &
    ArticlePreviewEvents &
    Omit<PropsOf<"article">, "title" | "text" | "onReady$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, text, onReady$, class: className, style, ...attributes }) => {
  const body = useSignal<HTMLParagraphElement>();
  const characters = useSignal(0);
  const counted = useSignal(false);

  useVisibleTask$(
    () => {
      const length = body.value?.textContent?.length ?? 0;
      characters.value = length;
      counted.value = true;
      onReady$?.(length);
    },
    { strategy: "document-ready" },
  );

  return (
    <article
      class={["article-preview", className]}
      aria-label={title}
      style={style}
      {...attributes}
    >
      <h2>{title}</h2>
      <p ref={body}>{text}</p>
      <p role="status">
        {counted.value ? `${characters.value} characters` : "Counting the characters"}
      </p>
    </article>
  );
});
