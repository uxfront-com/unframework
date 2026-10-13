// UF3037 unknown-model: `v-model:<name>` binds a model the component declares; `picked` is
// misspelt `pikced`, and the likely fix renames it.
import { defineModel, ref } from "unframework";

function Choice() {
  const picked = defineModel<string>("picked", { default: "" });
  return (
    <button type="button" onClick={() => (picked.value = "yes")}>
      Yes ({picked.value})
    </button>
  );
}

export default function Survey() {
  const answer = ref("");
  return (
    <section aria-label="Survey">
      <Choice v-model:pikced={answer.value} />
      <output>{answer.value}</output>
    </section>
  );
}
