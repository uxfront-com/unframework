import Steps from "./Steps";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { steps: string[] } & Omit<PropsOf<"div">, "steps" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ steps, class: className, style, ...attributes }) => {
  return (
    <div class={className} style={style} {...attributes}>
      <Steps steps={steps} marker$={() => <span aria-hidden="true">&gt; </span>} />
    </div>
  );
});
