import "./Article.css";
import Note from "./Note.uf.tsx";

export default function Article({ title, note }: { title: string; note: string }) {
  return (
    <article class="article">
      <h2 class="title">{title}</h2>
      <Note text={note} />
    </article>
  );
}
