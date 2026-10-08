import { type QRL, component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export interface ArticlePreviewEvents {
  onReady$?: QRL<(characters: number) => void>;
}

export default component$<ArticlePreviewProps & ArticlePreviewEvents>(
  ({ title, text, onReady$ }) => {
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
      <article class="article-preview" aria-label={title}>
        <h2>{title}</h2>
        <p ref={body}>{text}</p>
        <p role="status">
          {counted.value ? `${characters.value} characters` : "Counting the characters"}
        </p>
      </article>
    );
  },
);
