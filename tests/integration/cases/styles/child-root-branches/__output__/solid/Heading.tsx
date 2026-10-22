import { Dynamic } from "solid-js/web";

export default function Heading(props: { big: boolean; text: string }) {
  return (
    <Dynamic component={props.big ? "h2" : "h3"} class="heading" {...scopeAttributes(props)}>
      {props.text}
    </Dynamic>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
