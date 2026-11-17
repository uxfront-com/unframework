import { loadTeam, loadUser } from "./api";
import { type JSX, Show, Suspense, createMemo, createResource } from "solid-js";

export default function Membership(
  props: { id: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [awaited] = createResource(async () => {
    const user = await loadUser(props.id);
    const team = await loadTeam(user.teamId);
    return { user, team };
  });

  return (
    <Suspense>
      <Show when={awaited()}>
        {(resolved) => {
          const { user, team } = resolved();
          const summary = createMemo(() => `${user.name} is in ${team.name}`);

          return (
            <p
              class={props.class ? `membership ${props.class}` : "membership"}
              role="status"
              style={props.style}
              {...scopeAttributes(props)}
            >
              {summary()}
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
