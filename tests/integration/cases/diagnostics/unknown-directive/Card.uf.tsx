// UF3055 unknown-directive: `v-name` applies a directive the module declares or imports, so a
// name nothing declares and the name of a constant are rejected.
const vCount = 3;

export default function Card() {
  return (
    <section class="card">
      <p v-missing={true}>Missing</p>
      <p v-count={vCount}>Count</p>
    </section>
  );
}
