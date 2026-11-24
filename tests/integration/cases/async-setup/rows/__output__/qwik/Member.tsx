import { loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  untrack,
  useComputed$,
} from "@qwik.dev/core";

export default component$<
  { id: string } & Omit<PropsOf<"li">, "id" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, class: className, style, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(id)));
  const user = userLoad.value;

  return (
    <li class={["member", className]} style={style} {...attributes}>
      {user.name}
    </li>
  );
});
