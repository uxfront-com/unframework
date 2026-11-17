import { loadTeam, loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  component$,
  untrack,
  useComputed$,
} from "@qwik.dev/core";

export default component$<{ id: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ id, class: className, style, ...attributes }) => {
    const userLoad = useComputed$(() => untrack(() => loadUser(id)));
    const user = userLoad.value;
    const teamLoad = useComputed$(() => loadTeam(user.teamId));
    const team = teamLoad.value;
    const summary = useComputed$(() => `${user.name} is in ${team.name}`);

    return (
      <p
        class={["membership", className]}
        role="status"
        {...scopeAttributes(attributes)}
        style={style}
      >
        {summary.value}
      </p>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
