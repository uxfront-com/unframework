import { defineExpose, ref } from "unframework";

export default function Counter({ start }: { start: number }) {
  const count = ref(start);
  function increment() {
    count.value++;
  }
  const reset = () => {
    count.value = start;
  };
  defineExpose({ increment, reset });
  return <output class="count">{count.value}</output>;
}
