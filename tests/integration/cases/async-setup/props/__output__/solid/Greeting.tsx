import { loadUser } from "./api";
import { type JSX, Show, Suspense, createResource } from "solid-js";

export default function Greeting(
  props: { id: string; prefix: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [awaited] = createResource(async () => {
    const user = await loadUser(props.prefix + props.id);
    return { user };
  });

  return (
    <Suspense>
      <Show when={awaited()}>
        {(resolved) => {
          const { user } = resolved();

          return (
            <section
              class={props.class ? `greeting ${props.class}` : "greeting"}
              aria-label="Greeting"
              style={props.style}
              {...scopeAttributes(props)}
            >
              <h2>Hello, {user.name}</h2>
              <p>Signed in as {props.id}</p>
            </section>
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
