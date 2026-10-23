import Hint from "./Hint";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

type PanelLook = {
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: string;
  "--panel-gap"?: string;
};

interface PanelAttributes {
  id: string;
  title?: string;
  style?: PanelLook;
}

interface NoteAttributes {
  title: string;
  style?: string;
}

export interface PanelProps {
  heading: string;
  panel: PanelAttributes;
  note?: NoteAttributes;
}

export default component$<PanelProps & { class?: ClassList; style?: CSSProperties }>(
  ({ heading, panel, note, class: className, style, ...attributes }) => {
    return (
      <div class={["panels", className]} {...scopeAttributes(attributes)} style={style}>
        <section id={panel.id} title={panel.title} style={panel.style} class="panel">
          <h2 style={{ marginBottom: "var(--panel-gap, 4px)" }}>{heading}</h2>
          <p title={note?.title} style={note?.style}>
            Changes save as you type.
          </p>
          <Hint
            text="Saved a moment ago"
            attrs={{ id: "saved-hint", style: "font-style: italic; color: rgb(90, 90, 90)" }}
            style={{ color: "rgb(30, 90, 60)" }}
          />
        </section>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
