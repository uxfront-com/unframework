import { type Signal, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { ref?: Signal<Element | undefined> }>(
  ({ label, ref }) => {
    return <input name="bio" aria-label={label} ref={ref} />;
  },
);
