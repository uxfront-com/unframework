import Member from "./Member";
import { type ComponentProps, splitProps } from "solid-js";

export default function Lead(props: { id: string } & Omit<ComponentProps<typeof Member>, "id">) {
  const [, others] = splitProps(props, ["id"]);

  return <Member id={props.id} {...others} />;
}
