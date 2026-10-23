import "./Card.css";

export default function Card({ title }: { title: string }) {
  return (
    <section class="card">
      <h2 class="title">{title}</h2>
    </section>
  );
}
