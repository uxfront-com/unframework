// UF2005 misplaced-reactive-call: `watch` is called inside `onMounted`'s callback, where it would
// run per mount rather than once with the setup, and React's output could not make it a hook.
import { defineEmits, onMounted, ref, watch } from "unframework";

export default function Disclosure() {
  const emit = defineEmits<{ toggled: [open: boolean] }>();

  const open = ref(false);

  onMounted(() => {
    watch(open, (value) => {
      emit("toggled", value);
    });
  });

  return (
    <div class="disclosure">
      <button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
        Shipping details
      </button>
      {open.value && <p>Ships in two days.</p>}
    </div>
  );
}
