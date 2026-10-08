// UF2026 unsafe-teardown: `onUnmounted` reads the template ref `grid`, which Vue and React have
// emptied by then, while Svelte, Angular and Qwik still hold the element. Read the element while
// it is there (`onMounted`) and keep it for the teardown.
import { defineEmits, onUnmounted, useTemplateRef } from "unframework";

export default function PhotoGrid() {
  const emit = defineEmits<{ closed: [count: number] }>();
  const grid = useTemplateRef<HTMLUListElement>();

  onUnmounted(() => {
    emit("closed", grid.value?.childElementCount ?? 0);
  });

  return (
    <ul ref={grid} class="photo-grid" aria-label="Photos">
      <li>Harbour</li>
      <li>Lighthouse</li>
    </ul>
  );
}
