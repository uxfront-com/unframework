import { loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  untrack,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  { id: string } & Omit<PropsOf<"p">, "id" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, class: className, style, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(id)));
  const user = userLoad.value;
  const visits = useSignal(user.visits);

  return (
    <p class={["profile", className]} style={style} {...attributes}>
      {user.name}{" "}
      <button type="button" onClick$={() => visits.value++}>
        Visits: {visits.value}
      </button>
    </p>
  );
});
