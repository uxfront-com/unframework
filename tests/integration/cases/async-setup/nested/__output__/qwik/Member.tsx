import { loadUser } from "./api";
import {
  $,
  type CSSProperties,
  type ClassList,
  type Signal,
  component$,
  untrack,
  useComputed$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  { id: string } & { class?: ClassList; style?: CSSProperties; ref?: Signal<object | undefined> }
>(({ id, class: className, style, ref, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(id)));
  const user = userLoad.value;
  const visits = useSignal(user.visits);

  const reset = $(() => {
    visits.value = 0;
  });

  useTask$(() => {
    exposeRef(ref, { reset });
  });
  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => exposeRef(ref, undefined));
    },
    { strategy: "document-ready" },
  );

  return (
    <article class={["member", className]} {...scopeAttributes(attributes)} style={style}>
      <h3>{user.name}</h3>
      <button type="button" onClick$={() => visits.value++}>
        {user.name} visits: {visits.value}
      </button>
    </article>
  );
});

/**
 * Fills a consumer's component ref with what the component exposes, or empties it: Qwik has no
 * component instance for the ref to hold (ADR-0054).
 */
function exposeRef(ref: Signal<object | undefined> | undefined, exposed: object | undefined): void {
  if (ref) ref.value = exposed;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
