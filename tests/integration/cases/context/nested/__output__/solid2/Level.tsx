import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, omit, useContext } from "solid-js";

export interface LevelSlots {
  children?: JSX.Element;
}

export const DepthKey = createContext<number | null>(null);

export default function Level(
  props: { title: string } & LevelSlots &
    Omit<ComponentProps<"section">, "title" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "children");

  const depth = useContext(DepthKey) ?? 0;

  return (
    <DepthKey value={depth + 1}>
      <section aria-label={props.title} {...others}>
        <h2>
          {props.title} at depth {depth}
        </h2>
        {props.children}
      </section>
    </DepthKey>
  );
}
