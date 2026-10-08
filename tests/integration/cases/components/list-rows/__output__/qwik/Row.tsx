import { component$ } from "@qwik.dev/core";

export default component$<{ name: string; done: boolean }>(({ name, done }) => {
  return (
    <div role="listitem" class={["row", { done }]}>
      {name}
      {done ? " (done)" : ""}
    </div>
  );
});
