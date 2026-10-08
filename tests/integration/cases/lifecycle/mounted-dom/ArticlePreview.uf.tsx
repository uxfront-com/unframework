import { defineEmits, onMounted, ref, useTemplateRef } from "unframework";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export default function ArticlePreview({ title, text }: ArticlePreviewProps) {
  const emit = defineEmits<{ ready: [characters: number] }>();

  const body = useTemplateRef<HTMLParagraphElement>();
  const characters = ref(0);
  const counted = ref(false);

  onMounted(() => {
    const length = body.value?.textContent?.length ?? 0;
    characters.value = length;
    counted.value = true;
    emit("ready", length);
  });

  return (
    <article class="article-preview" aria-label={title}>
      <h2>{title}</h2>
      <p ref={body}>{text}</p>
      <p role="status">
        {counted.value ? `${characters.value} characters` : "Counting the characters"}
      </p>
    </article>
  );
}
