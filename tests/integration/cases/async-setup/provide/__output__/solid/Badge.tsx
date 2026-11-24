import { type ComponentProps, type JSX, createContext, splitProps, useContext } from "solid-js";

export const ToneKey = createContext<string>();

export default function Badge(
  props: Omit<ComponentProps<"span">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const tone = useContext(ToneKey) ?? "plain";

  return (
    <span class={props.class ? `badge ${props.class}` : "badge"} {...others}>
      Tone: {tone}
    </span>
  );
}
