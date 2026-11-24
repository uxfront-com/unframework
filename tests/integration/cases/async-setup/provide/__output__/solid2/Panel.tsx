import Badge, { ToneKey } from "./Badge";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import { loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, omit, untrack } from "solid-js";

export interface PanelSlots {
  children?: JSX.Element;
}

export default function Panel(
  props: { id: string } & PanelSlots &
    Omit<ComponentProps<"section">, "id" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "id", "children", "class");

  const awaited = createMemo(async () => {
    const user = await untrack(() => loadUser(props.id));
    return { user };
  });

  return (
    <Loading>
      <Show when={awaited()} keyed>
        {(resolved) => {
          const { user } = resolved;

          return (
            <ToneKey value={"calm"}>
              <section
                class={props.class ? `panel ${props.class}` : "panel"}
                aria-label={enumeratedValue(user.name)}
                {...others}
              >
                <Badge />
                {props.children}
              </section>
            </ToneKey>
          );
        }}
      </Show>
    </Loading>
  );
}
