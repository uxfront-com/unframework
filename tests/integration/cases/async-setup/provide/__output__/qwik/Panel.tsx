import Badge, { ToneKey } from "./Badge";
import { loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  Slot,
  component$,
  untrack,
  useComputed$,
  useContextProvider,
} from "@qwik.dev/core";

export default component$<{ id: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ id, class: className, style, ...attributes }) => {
    const userLoad = useComputed$(() => untrack(() => loadUser(id)));
    const user = userLoad.value;

    useContextProvider(ToneKey, "calm");

    return (
      <section
        class={["panel", className]}
        aria-label={user.name}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Badge />
        <Slot />
      </section>
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
