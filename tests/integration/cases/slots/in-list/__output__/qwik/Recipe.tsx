import Steps from "./Steps";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ steps: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ steps, class: className, style }) => {
    return (
      <div class={className} style={style}>
        <Steps steps={steps} marker$={() => <span aria-hidden="true">&gt; </span>} />
      </div>
    );
  },
);
