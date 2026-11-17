import { loadUser } from "./api";
import { type JSX, Show, Suspense, createResource, createSignal, untrack } from "solid-js";

export default function Member(
  props: { id: string } & {
    class?: string;
    style?: JSX.CSSProperties;
    ref?: (api: { reset: () => void }) => void;
  },
) {
  const [awaited] = createResource(async () => {
    const user = await loadUser(props.id);
    return { user };
  });

  return (
    <Suspense>
      <Show when={awaited()}>
        {(resolved) => {
          const { user } = resolved();
          const [visits, setVisits] = createSignal(user.visits);

          function reset() {
            setVisits(0);
          }

          untrack(() => props.ref?.({ reset }));

          return (
            <article
              class={props.class ? `member ${props.class}` : "member"}
              style={props.style}
              {...scopeAttributes(props)}
            >
              <h3>{user.name}</h3>
              <button type="button" onClick={() => setVisits(visits() + 1)}>
                {user.name} visits: {visits()}
              </button>
            </article>
          );
        }}
      </Show>
    </Suspense>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
