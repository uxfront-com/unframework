import "./Action.css";

export default function Action({ text }: { text: string }) {
  return (
    <button type="button" class="action">
      {text}
    </button>
  );
}
