// UF3028 template-ref-use: `el.textContent = …` rewrites the text of an element the template
// renders, which every framework renders from state; render the text from state instead.
import { useTemplateRef } from "unframework";

export default function HelpPanel() {
  const panel = useTemplateRef<HTMLElement>();

  function reveal() {
    const el = panel.value;
    if (el) el.textContent = "Press the question mark to see the shortcuts.";
  }

  return (
    <aside class="help-panel" aria-label="Help" ref={panel}>
      <p>The shortcuts are hidden.</p>
      <button type="button" onClick={reveal}>
        Show the shortcuts
      </button>
    </aside>
  );
}
