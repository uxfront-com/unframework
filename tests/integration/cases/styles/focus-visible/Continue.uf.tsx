import "./Continue.css";

export default function Continue({ text }: { text: string }) {
  return (
    <button type="button" class="continue">
      {text}
    </button>
  );
}
