import "./Toolbar.css";
import Button from "./Button.uf.tsx";

export default function Toolbar() {
  return (
    <div role="toolbar" aria-label="Actions" class="toolbar">
      <Button text="Save" />
      <Button text="Cancel" />
    </div>
  );
}
