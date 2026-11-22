// UF2040 misplaced-dev-check: `isDev` is read only as the whole test of an `if` with no `else`,
// at the top level of the setup or in client code. Its value, its negation, an `else`, a
// template, a getter and a template's call of a function that tests it are rejected; the two
// accepted forms report nothing.
import { computed, isDev, onMounted } from "@uxfront/unframework";

export default function Badge({ text }: { text: string }) {
  const dev = isDev;
  const shown = computed(() => (isDev ? text : ""));
  function mode() {
    if (isDev) return "dev";
    return "prod";
  }
  if (isDev) {
    console.warn("accepted");
  } else {
    console.warn("an else");
  }
  if (!isDev) console.warn("a negation");
  if (isDev) console.warn("accepted");
  onMounted(() => {
    if (isDev) console.warn("accepted");
    console.warn(isDev && dev);
  });
  return (
    <p>
      {shown.value} {isDev ? "dev" : ""} {mode()}
    </p>
  );
}
