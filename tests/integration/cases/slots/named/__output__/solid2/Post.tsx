import Card from "./Card";
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";

export default function Post(
  props: { author: string } & Omit<
    ComponentProps<typeof Card>,
    "author" | "children" | "header" | "footer"
  >,
) {
  const others = omit(props, "author");

  return (
    <Card {...others} header={<h2>Release notes</h2>} footer={<small>By {props.author}</small>}>
      <p>Slots arrive in M3.</p>
    </Card>
  );
}
