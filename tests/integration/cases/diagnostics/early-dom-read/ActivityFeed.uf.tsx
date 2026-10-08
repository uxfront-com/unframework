// UF2018 early-dom-read: the watcher reads the list through a template ref, but a watcher runs
// before the DOM has updated; the likely fix runs it after the update with `{ flush: "post" }`.
import { defineEmits, ref, useTemplateRef, watch } from "unframework";

export default function ActivityFeed() {
  const emit = defineEmits<{ rendered: [count: number] }>();

  const items = ref(["Signed in"]);
  const list = useTemplateRef<HTMLUListElement>();

  watch(items, () => {
    emit("rendered", list.value?.childElementCount ?? 0);
  });

  function add() {
    items.value = [...items.value, `Event ${items.value.length + 1}`];
  }

  return (
    <section class="activity-feed" aria-label="Activity">
      <ul ref={list}>
        {items.value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button type="button" onClick={add}>
        Add an event
      </button>
    </section>
  );
}
