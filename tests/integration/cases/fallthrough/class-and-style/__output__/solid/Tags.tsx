import Tag from "./Tag";
import { type JSX, createSignal } from "solid-js";

export default function Tags(props: { class?: string; style?: JSX.CSSProperties }) {
  const [active, setActive] = createSignal(false);

  return (
    <div
      class={props.class ? `tags ${props.class}` : "tags"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Tag label="plain" />
      <Tag label="wide" class="wide" style={{ "margin-left": "8px" }} />
      <Tag
        label="toggled"
        class={cx("picked", { active: active() })}
        style={{ color: active() ? "rgb(200, 0, 0)" : undefined }}
      />
      <button type="button" onClick={() => setActive(!active())}>
        Toggle
      </button>
    </div>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
