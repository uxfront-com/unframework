import { loadUser } from "./api";
import { type JSX, Show, Suspense, createResource, createSignal } from "solid-js";

export default function Profile(
  props: { id: string } & { class?: string; style?: JSX.CSSProperties },
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

          return (
            <p
              class={props.class ? `profile ${props.class}` : "profile"}
              style={props.style}
              {...scopeAttributes(props)}
            >
              {user.name}{" "}
              <button type="button" onClick={() => setVisits(visits() + 1)}>
                Visits: {visits()}
              </button>
            </p>
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
