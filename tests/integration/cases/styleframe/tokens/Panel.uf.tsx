import "virtual:styleframe.css";
import "./Panel.css";

export default function Panel({ text }: { text: string }) {
  return (
    <section class="panel">
      <p class="body">{text}</p>
    </section>
  );
}
