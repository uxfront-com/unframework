import Hint from "./Hint";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import type { CSSProperties } from "react";

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

export interface PanelAttributes_1 {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({
  heading,
  panel,
  note,
  className,
  style,
  ...attributes
}: PanelProps & PanelAttributes_1) {
  return (
    <div className={cx("panels", className)} style={style} {...scopeAttributes(attributes)}>
      <section id={panel.id} title={panel.title} style={styleObject(panel.style)} className="panel">
        <h2 style={{ marginBottom: "var(--panel-gap, 4px)" }}>{heading}</h2>
        <p title={note?.title} style={styleObject(note?.style)}>
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
