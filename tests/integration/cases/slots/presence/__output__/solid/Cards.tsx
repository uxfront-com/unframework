import Card from "./Card";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Cards(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  return (
    <div class={props.class ? `cards ${props.class}` : "cards"} {...others}>
      <Card label="Full" title={<h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
  );
}
