import { defineSlots, ref, type Element } from "@uxfront/unframework";

export default function Card() {
  const slots = defineSlots<{ default?(): Element }>();
  const open = ref(false);

  return (
    <div class="card">
      <button type="button" onClick={() => (open.value = !open.value)}>
        Toggle card
      </button>
      {open.value && <div class="body">{slots.default?.()}</div>}
    </div>
  );
}
