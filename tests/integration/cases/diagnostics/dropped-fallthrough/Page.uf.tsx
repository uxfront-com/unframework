// UF3045 dropped-fallthrough: `Stack` renders two roots, so no target knows which a `class` passed
// to it would go to.
function Stack() {
  return (
    <>
      <p>First</p>
      <p>Second</p>
    </>
  );
}

export default function Page() {
  return (
    <main>
      <Stack class="spaced" />
    </main>
  );
}
