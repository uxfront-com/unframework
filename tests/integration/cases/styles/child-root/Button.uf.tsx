// An unstyled child: its root takes its styled parent's scope attribute, and nothing inside it
// does.
export default function Button({ text }: { text: string }) {
  return (
    <button type="button" class="button">
      <span class="icon" aria-hidden="true">
        +
      </span>
      {text}
    </button>
  );
}
