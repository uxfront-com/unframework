import Heading from "./Heading.uf.tsx";

export default function Section({ title, body }: { title: string; body: string }) {
  return (
    <section class="section">
      <Heading text={title} />
      <p>{body}</p>
    </section>
  );
}
