import { ref } from "unframework";

// Listeners that only make a control (ADR-0047): a form whose submit listener only prevents the
// submission, and a toolbar button whose mousedown listener only prevents the focus moving.
export default function Bare() {
  const bold = ref(0);
  return (
    <section aria-label="Bare">
      <form aria-label="Quick" onSubmit={(event) => event.preventDefault()}>
        <label>
          Note
          <input name="note" />
        </label>
        <button type="submit">Send</button>
      </form>
      <label>
        Draft
        <input name="draft" />
      </label>
      <button
        type="button"
        onMousedown={(event) => event.preventDefault()}
        onClick={() => (bold.value += 1)}
      >
        Bold
      </button>
      <p role="status">{bold.value}</p>
    </section>
  );
}
