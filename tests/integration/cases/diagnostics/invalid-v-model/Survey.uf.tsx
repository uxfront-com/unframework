// UF3042 invalid-v-model: `v-model` on a component binds a model by its name; the safe fix names
// the one model `Choice` declares.
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
      <Choice v-model={answer.value} />
      <output>{answer.value}</output>
    </section>
  );
}
