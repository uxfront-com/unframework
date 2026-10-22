import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface AvatarEvents {
  onPickedURL$?: QRL<(url: string) => void>;
}

export default component$<
  { imageURL: string; userID: number } & AvatarEvents & { class?: ClassList; style?: CSSProperties }
>(({ imageURL, userID, onPickedURL$, class: className, style, ...attributes }) => {
  return (
    <button
      type="button"
      data-user={userID}
      onClick$={() => onPickedURL$?.(imageURL)}
      {...scopeAttributes(attributes)}
      class={className}
      style={style}
    >
      User {userID}: {imageURL}
    </button>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
