import { Dynamic, type JSX } from "@solidjs/web";

export interface BaseEvents {
  onPress?: () => void;
}

export default function Base(
  props: { href?: string; disabled?: boolean; text: string } & BaseEvents & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  function press(event: MouseEvent) {
    event.preventDefault();
    props.onPress?.();
  }

  return (
    <Dynamic
      component={props.href ? "a" : "button"}
      href={(props.href ? "a" : "button") === "a" ? props.href : undefined}
      disabled={(props.href ? "a" : "button") === "button" ? props.disabled : undefined}
      class={props.class ? `base ${props.class}` : "base"}
      style={{ ...{ padding: "4px 8px" }, ...props.style }}
      onClick={press}
      {...scopeAttributes(props)}
    >
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
