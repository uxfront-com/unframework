import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, omit, untrack } from "solid-js";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default function WelcomeBanner(
  props: WelcomeBannerProps &
    Omit<ComponentProps<"section">, "name" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name", "class");

  const greeting = untrack(() => `Welcome, ${props.name}`);

  return (
    <section
      class={props.class ? `welcome-banner ${props.class}` : "welcome-banner"}
      aria-label="Welcome"
      {...others}
    >
      <h2>{greeting}</h2>
      <p>Signed in as {props.name}</p>
      <ul>
        <KeyedFor each={tips} by={(tip) => tip}>
          {(tip) => <li>{tip.value}</li>}
        </KeyedFor>
      </ul>
    </section>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
