import Member from "./Member";
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";

export default function Lead(props: { id: string } & Omit<ComponentProps<typeof Member>, "id">) {
  const others = omit(props, "id");

  return <Member id={props.id} {...others} />;
}
