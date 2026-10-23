// UF5003 unsupported-stylesheet-language: the component imports a Sass stylesheet.
import "./Panel.scss";

export default function Panel({ title }: { title: string }) {
  return (
    <section class="panel">
      <h2>{title}</h2>
    </section>
  );
}
