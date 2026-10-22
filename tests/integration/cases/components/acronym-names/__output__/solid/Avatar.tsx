import type { JSX } from "solid-js";

export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export default function Avatar(
  props: { imageURL: string; userID: number } & AvatarEvents & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  return (
    <button
      type="button"
      data-user={props.userID}
      onClick={() => props.onPickedURL?.(props.imageURL)}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      User {props.userID}: {props.imageURL}
    </button>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
