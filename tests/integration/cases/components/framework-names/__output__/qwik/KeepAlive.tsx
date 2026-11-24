import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

const KeepAlive = component$<
  { level: number } & Omit<PropsOf<"div">, "level" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ level, class: className, style, ...attributes }) => {
  return (
    <div class={["level", className]} style={style} {...attributes}>
      <span>Level {level}</span>
      {level > 0 ? <KeepAlive level={level - 1} /> : null}
    </div>
  );
});
export default KeepAlive;
