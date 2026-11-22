import Card from "./Card";
import { type ComponentProps, splitProps } from "solid-js";

export default function Post(
  props: { author: string } & Omit<
    ComponentProps<typeof Card>,
    "author" | "children" | "header" | "footer"
  >,
) {
  const [, others] = splitProps(props, ["author"]);

  return (
    <Card {...others} header={<h2>Release notes</h2>} footer={<small>By {props.author}</small>}>
      <p>Slots arrive in M3.</p>
    </Card>
  );
}
