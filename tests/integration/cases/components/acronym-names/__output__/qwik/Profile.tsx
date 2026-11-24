import Avatar from "./Avatar";
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
  const picked = useSignal("none");

  return (
    <div class={className} style={style} {...attributes}>
      <Avatar imageURL="/a.png" userID={7} onPickedURL$={(url) => (picked.value = url)} />
      <output>Picked: {picked.value}</output>
    </div>
  );
});
