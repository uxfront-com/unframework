import Section from "./Section.uf.tsx";

export default function Page({ name }: { name: string }) {
  return (
    <article aria-label="Profile">
      <Section title={`About ${name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${name}.`} />
    </article>
  );
}
