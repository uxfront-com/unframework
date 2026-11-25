import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface AddressProps {
  name: string;
  street: string;
  city?: string;
}

export default function Address(
  props: AddressProps &
    Omit<ComponentProps<"pre">, "name" | "street" | "city" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name", "street", "city");

  return (
    <pre {...others}>
      {props.name}
      {["\n"]}
      {props.street}
      {["\n"]}
      {props.city ?? "-"}
    </pre>
  );
}
