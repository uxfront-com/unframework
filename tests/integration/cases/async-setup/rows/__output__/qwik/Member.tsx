import { loadUser } from "./api";
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

    return (
      <li class={["member", className]} {...scopeAttributes(attributes)} style={style}>
        {user.name}
      </li>
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
