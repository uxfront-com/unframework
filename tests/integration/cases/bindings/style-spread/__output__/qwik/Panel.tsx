import Hint from "./Hint";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

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

export default component$<
  PanelProps &
    Omit<PropsOf<"div">, "heading" | "panel" | "note" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ heading, panel, note, class: className, style, ...attributes }) => {
  return (
    <div class={["panels", className]} style={style} {...attributes}>
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
});
