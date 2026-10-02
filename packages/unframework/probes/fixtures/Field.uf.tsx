import {
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  useId,
  useTemplateRef,
  watch,
  watchEffect,
} from "unframework";

import { TabsKey, type Tabs } from "./keys.ts";

export interface FieldProps {
  label: string;
  tabs?: Tabs;
}

export function Field({ label, tabs }: FieldProps) {
  const id = useId();
  const text = ref("");
  const count = ref(0);
  const agreed = ref(false);
  const picked = ref<string[]>([]);
  const input = useTemplateRef<HTMLInputElement>();
  const parent = inject(TabsKey);
  const fallback = inject(TabsKey, tabs ?? { active: ref("a"), select: () => {} });
  if (tabs) provide(TabsKey, tabs);

  watch(text, (value, previous, onCleanup) => {
    const handle = setTimeout(() => console.log(value.toUpperCase(), previous.length), 100);
    onCleanup(() => clearTimeout(handle));
  });
  watch([text, count], ([t, c]) => console.log(t.trim(), c.toFixed(1)), { immediate: true });
  watch(
    () => count.value * 2,
    (doubled) => console.log(doubled.toFixed(0)),
    { flush: "post" },
  );
  watchEffect((onCleanup) =>
    onCleanup(() => console.log(parent?.active.value, fallback.active.value)),
  );

  async function reveal(): Promise<void> {
    await nextTick();
    input.value?.focus();
  }
  onMounted(() => {
    reveal().catch(reportError);
  });
  onUnmounted(() => console.log("bye"));

  return (
    <div
      class={["field", { "field--filled": text.value !== "" }]}
      style={{ "--gap": "4px", display: "grid" }}
    >
      <label for={id}>{label}</label>
      <input
        id={id}
        ref={input}
        v-model_trim={text.value}
        onKeydown={(event) => event.key === "Enter" && event.preventDefault()}
      />
      <input type="number" v-model_number={count.value} />
      <input type="checkbox" v-model={agreed.value} />
      <select multiple v-model={picked.value}>
        <option value="a">A</option>
      </select>
      <textarea v-model_lazy={text.value} />
    </div>
  );
}
