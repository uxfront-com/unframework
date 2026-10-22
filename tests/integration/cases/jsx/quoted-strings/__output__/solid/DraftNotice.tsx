import type { JSX } from "solid-js";

export interface DraftNoticeProps {
  author: string;
  saved: boolean;
}

export default function DraftNotice(
  props: DraftNoticeProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `draft-notice ${props.class}` : "draft-notice"}
      aria-label="Draft"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
        alt={`${props.author}'s avatar`}
        width="32"
        height="32"
      />
      <p title={props.saved ? "Saved" : "Don't forget to save"}>
        {props.saved ? "Saved" : 'Not "saved" yet'}
      </p>
      <p title={props.saved ? "Nothing to save" : `Press "Save" to keep ${props.author}'s changes`}>
        {props.saved
          ? `${props.author}'s draft is safe.`
          : `${props.author} says: "I'll save it later."`}
      </p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
