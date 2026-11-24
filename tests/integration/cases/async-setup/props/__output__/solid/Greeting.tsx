import { loadUser } from "./api";
import {
  type ComponentProps,
  type JSX,
  Show,
  Suspense,
  createResource,
  splitProps,
} from "solid-js";

export default function Greeting(
  props: { id: string; prefix: string } & Omit<
    ComponentProps<"section">,
    "id" | "prefix" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["id", "prefix", "class"]);

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
              {...others}
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
