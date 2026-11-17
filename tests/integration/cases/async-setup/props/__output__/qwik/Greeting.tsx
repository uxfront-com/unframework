import { loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  component$,
  untrack,
  useComputed$,
} from "@qwik.dev/core";

export default component$<
  { id: string; prefix: string } & { class?: ClassList; style?: CSSProperties }
>(({ id, prefix, class: className, style, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(prefix + id)));
  const user = userLoad.value;

  return (
    <section
      class={["greeting", className]}
      aria-label="Greeting"
      {...scopeAttributes(attributes)}
      style={style}
    >
      <h2>Hello, {user.name}</h2>
      <p>Signed in as {id}</p>
    </section>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
