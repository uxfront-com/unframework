import Card from "./Card";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Cards(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  return (
    <div class={props.class ? `cards ${props.class}` : "cards"} {...others}>
      <Card label="Full" title={<h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
  );
}
