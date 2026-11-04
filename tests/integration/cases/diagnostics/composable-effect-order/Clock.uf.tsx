// UF4005 composable-effect-order (info, React and Solid): the component calls a composable whose
// mounted hook runs code in the browser. React and Solid run a hook's effects in their own
// order, so where they run among the component's own isn't the source's order there.
import { onMounted, ref } from "unframework";

import { useClock } from "./useClock.uf.ts";

export default function Clock() {
  const ready = ref(false);

  onMounted(() => {
    ready.value = true;
  });

  const { started } = useClock();

  return (
    <p class="clock">
      {ready.value ? "Ready" : "Waiting"}, {started.value ? "started" : "stopped"}
    </p>
  );
}
