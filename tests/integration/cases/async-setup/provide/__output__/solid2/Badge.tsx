import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, omit, useContext } from "solid-js";

export const ToneKey = createContext<string | null>(null);

export default function Badge(
  props: Omit<ComponentProps<"span">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const tone = useContext(ToneKey) ?? "plain";

  return (
    <span class={props.class ? `badge ${props.class}` : "badge"} {...others}>
      Tone: {tone}
    </span>
  );
}
