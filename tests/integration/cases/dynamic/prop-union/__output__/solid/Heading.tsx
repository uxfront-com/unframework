import { Dynamic } from "solid-js/web";

export default function Heading(props: { tag: "h1" | "h2" | "h3"; text: string }) {
  return (
    <Dynamic component={props.tag} class="heading">
      {props.text}
    </Dynamic>
  );
}
