// Legitimate setup code (plan §4.2). Nothing here may error.
import { computed, defineEmits, defineModel, inject, provide, ref, watch } from "unframework";

import { TabsKey } from "../fixtures/keys.ts";

export interface StepperProps {
  label: string;
  step?: number;
}

// `(props: P)` is accepted when no prop has a default.
export function Stepper(props: StepperProps) {
  const emit = defineEmits<{ change: [value: number]; reset: [] }>();
  // `required: true` and `default` make the model's value `T`; without either it is `T | undefined`.
  const value = defineModel<number>("value", { required: true });
  const open = defineModel<boolean>("open", { default: false });
  const note = defineModel<string>("note");
  const count = ref(0);
  const total = computed(() => count.value + value.value);
  const tabs = inject(TabsKey, { active: ref("a"), select: () => {} });
  provide(TabsKey, tabs);

  watch(count, (next, previous) => console.log(next - previous));
  watch(open, (next, previous) => console.log(next, previous ?? false), { immediate: true });

  function increment() {
    count.value++;
    count.value += props.step ?? 1;
    value.value = total.value;
    emit("change", value.value);
  }

  function reset() {
    count.value = 0;
    note.value = undefined;
    tabs.select("a");
    emit("reset");
  }

  return (
    <div>
      <output>{value.value.toFixed(1)}</output>
      <button type="button" onClick={increment}>
        {props.label}
      </button>
      <button type="button" onClick={reset}>
        Reset
      </button>
      {note.value ?? "No note"}
    </div>
  );
}
