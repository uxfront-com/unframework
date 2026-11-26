import Hint from "./Hint";
import { styleProperties } from "./_unframework/styleProperties";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

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

export default function Panel(
  props: PanelProps &
    Omit<ComponentProps<"div">, "heading" | "panel" | "note" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "heading", "panel", "note", "class");

  return (
    <div class={props.class ? `panels ${props.class}` : "panels"} {...others}>
      <section
        id={props.panel.id}
        title={props.panel.title}
        style={styleProperties(props.panel.style)}
        class="panel"
      >
        <h2 style={{ "margin-bottom": "var(--panel-gap, 4px)" }}>{props.heading}</h2>
        <p title={props.note?.title} style={styleProperties(props.note?.style)}>
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
}
