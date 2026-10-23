import Hint from "./Hint.uf.tsx";

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

export default function Panel({ heading, panel, note }: PanelProps) {
  return (
    <div class="panels">
      <section {...panel} class="panel">
        <h2 style={{ marginBottom: "var(--panel-gap, 4px)" }}>{heading}</h2>
        <p {...note}>Changes save as you type.</p>
        <Hint
          text="Saved a moment ago"
          attrs={{ id: "saved-hint", style: "font-style: italic; color: rgb(90, 90, 90)" }}
          style={{ color: "rgb(30, 90, 60)" }}
        />
      </section>
    </div>
  );
}
