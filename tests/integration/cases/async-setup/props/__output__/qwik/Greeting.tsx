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
  { id: string; prefix: string } & Omit<PropsOf<"section">, "id" | "prefix" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, prefix, class: className, style, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(prefix + id)));
  const user = userLoad.value;

  return (
    <section class={["greeting", className]} aria-label="Greeting" style={style} {...attributes}>
      <h2>Hello, {user.name}</h2>
      <p>Signed in as {id}</p>
    </section>
  );
});
