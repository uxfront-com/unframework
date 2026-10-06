// UF3014 misplaced-key: `key` outside the body of a list does nothing; the safe fix removes it.
export default function Intro() {
  return (
    <section>
      <p key="intro">Welcome.</p>
    </section>
  );
}
