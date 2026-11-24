import { loadTeam, loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  untrack,
  useComputed$,
} from "@qwik.dev/core";

export default component$<
  { id: string } & Omit<PropsOf<"p">, "id" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, class: className, style, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(id)));
  const user = userLoad.value;
  const teamLoad = useComputed$(() => loadTeam(user.teamId));
  const team = teamLoad.value;
  const summary = useComputed$(() => `${user.name} is in ${team.name}`);

  return (
    <p class={["membership", className]} role="status" style={style} {...attributes}>
      {summary.value}
    </p>
  );
});
