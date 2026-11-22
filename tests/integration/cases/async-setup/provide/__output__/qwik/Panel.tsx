import Badge, { ToneKey } from "./Badge";
import { loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  untrack,
  useComputed$,
  useContextProvider,
} from "@qwik.dev/core";

export default component$<
  { id: string } & Omit<PropsOf<"section">, "id" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, class: className, style, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(id)));
  const user = userLoad.value;

  useContextProvider(ToneKey, "calm");

  return (
    <section class={["panel", className]} aria-label={user.name} style={style} {...attributes}>
      <Badge />
      <Slot />
    </section>
  );
});
