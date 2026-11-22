import { type ComponentProps, type JSX, createContext, splitProps, useContext } from "solid-js";

export interface LevelSlots {
  children?: JSX.Element;
}

export const DepthKey = createContext<number>();

export default function Level(
  props: { title: string } & LevelSlots &
    Omit<ComponentProps<"section">, "title" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "children"]);

  const depth = useContext(DepthKey) ?? 0;

  return (
    <DepthKey.Provider value={depth + 1}>
      <section aria-label={props.title} {...others}>
        <h2>
          {props.title} at depth {depth}
        </h2>
        {props.children}
      </section>
    </DepthKey.Provider>
  );
}
