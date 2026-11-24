import Picker from "./Picker";
import { type ComponentProps, splitProps } from "solid-js";

interface Fruit {
  name: string;
  count: number;
}

export default function Fruits(
  props: { fruits: Fruit[] } & Omit<ComponentProps<typeof Picker>, "fruits" | "item" | "items">,
) {
  const [, others] = splitProps(props, ["fruits"]);

  return (
    <Picker
      items={props.fruits}
      {...others}
      item={({ item }) => (
        <span>
          {item.name} × {item.count}
        </span>
      )}
    />
  );
}
