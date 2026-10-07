import {
  defineEmits,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watchEffect,
} from "unframework";

// Lifecycle (ADR-0048): `onMounted` once the DOM is in the document, `onUnmounted` on removal,
// `watchEffect` after the first render and on each change; `nextTick` and a ref in a branch.
export default function Lifecycle({ name }: { name: string }) {
  const emit = defineEmits<{
    mounted: [length: number];
    unmounted: [];
    effect: [label: string];
    items: [count: number];
  }>();

  const body = useTemplateRef<HTMLParagraphElement>();
  const list = useTemplateRef<HTMLUListElement>();
  const open = ref(false);
  const count = ref(0);

  onMounted(() => {
    emit("mounted", body.value?.textContent?.length ?? 0);
  });

  onUnmounted(() => {
    emit("unmounted");
  });

  watchEffect(() => {
    emit("effect", `${name} ${count.value}`);
  });

  async function toggle() {
    open.value = !open.value;
    await nextTick();
    emit("items", list.value?.childElementCount ?? 0);
  }

  return (
    <section>
      <p ref={body}>Hello, {name}</p>
      <button type="button" onClick={() => count.value++}>
        Count
      </button>
      <button type="button" aria-expanded={open.value} onClick={toggle}>
        Toggle
      </button>
      {open.value && (
        <ul ref={list}>
          <li>One</li>
          <li>Two</li>
        </ul>
      )}
    </section>
  );
}
