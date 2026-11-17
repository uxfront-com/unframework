import { loadUser } from "./api";
import { type JSX, Show, Suspense, createResource } from "solid-js";

export default function Member(
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

          return (
            <li
              class={props.class ? `member ${props.class}` : "member"}
              style={props.style}
              {...scopeAttributes(props)}
            >
              {user.name}
            </li>
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
