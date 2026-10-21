// UF5001 shared-stylesheet: a module of two components imports a stylesheet, which then has no
// single owner.
import "./Toolbar.css";

export function ToolbarButton({ label }: { label: string }) {
  return (
    <button type="button" class="toolbar-button">
      {label}
    </button>
  );
}

export default function Toolbar() {
  return (
    <div class="toolbar">
      <ToolbarButton label="Bold" />
    </div>
  );
}
