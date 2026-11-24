import { loadUser } from "./api";
import {
  type ComponentProps,
  type JSX,
  Show,
  Suspense,
  createResource,
  splitProps,
} from "solid-js";

export default function Member(
  props: { id: string } & Omit<ComponentProps<"li">, "id" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["id", "class"]);

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
            <li class={props.class ? `member ${props.class}` : "member"} {...others}>
              {user.name}
            </li>
          );
        }}
      </Show>
    </Suspense>
  );
}
