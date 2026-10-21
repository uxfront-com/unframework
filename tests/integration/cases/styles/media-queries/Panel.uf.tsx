import "./Panel.css";

export default function Panel({ text }: { text: string }) {
  return (
    <aside class="panel">
      <p class="text">{text}</p>
    </aside>
  );
}
