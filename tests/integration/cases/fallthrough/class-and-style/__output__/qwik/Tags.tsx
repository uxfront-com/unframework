import Tag from "./Tag";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const active = useSignal(false);

  return (
    <div class={["tags", className]} style={style} {...attributes}>
      <Tag label="plain" />
      <Tag label="wide" class={["wide"]} style={{ marginLeft: "8px" }} />
      <Tag
        label="toggled"
        class={["picked", { active: Boolean(active.value) }]}
        style={{ color: active.value ? "rgb(200, 0, 0)" : undefined }}
      />
      <button type="button" onClick$={() => (active.value = !active.value)}>
        Toggle
      </button>
    </div>
  );
});
