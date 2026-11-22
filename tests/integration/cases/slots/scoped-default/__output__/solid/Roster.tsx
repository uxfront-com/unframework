import Names from "./Names";
import { type ComponentProps, splitProps } from "solid-js";

export default function Roster(
  props: { names: string[] } & Omit<ComponentProps<typeof Names>, "names" | "children">,
) {
  const [, others] = splitProps(props, ["names"]);

  return <Names names={props.names} {...others} children={({ item }) => <b>{item}!</b>} />;
}
