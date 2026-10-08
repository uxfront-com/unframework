import { defineEmits, onMounted, watch } from "unframework";

export interface SectionHeadingProps {
  title: string;
}

export default function SectionHeading({ title }: SectionHeadingProps) {
  const emit = defineEmits<{ change: [title: string, previous?: string]; ready: [] }>();

  watch(
    () => title,
    (value, previous) => {
      emit("change", value, previous);
    },
    { immediate: true },
  );

  onMounted(() => {
    emit("ready");
  });

  return <h2 class="section-heading">{title}</h2>;
}
