import { ref } from "unframework";

// A `v-model` beside a listener of its event: one prop runs the model's handler, then the
// listener (src/listeners.ts), which reads what the model wrote.
export default function ModelListeners() {
  const text = ref("");
  const on = ref(false);
  const seen = ref<string[]>([]);
  return (
    <div>
      <input
        aria-label="Name"
        onInput={() => (seen.value = [...seen.value, text.value])}
        v-model={text.value}
      />
      <input
        type="checkbox"
        aria-label="On"
        v-model={on.value}
        onChange={() => (seen.value = [...seen.value, String(on.value)])}
      />
      <p role="status">{seen.value.join(",")}</p>
    </div>
  );
}
