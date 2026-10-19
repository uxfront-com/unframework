// UF3050 undefined-model-binding: `query` has neither a `default` nor `required: true`, so it can
// be `undefined`, and the typed targets write its changes back with that type. `term` holds a
// `string` only, so it cannot be bound to it.
import { defineModel, ref } from "unframework";

function SearchField() {
  const query = defineModel<string>("query");
  return <input type="search" aria-label="Search" v-model={query.value} />;
}

export default function Search() {
  const term = ref("");
  return (
    <section aria-label="Search">
      <SearchField v-model:query={term.value} />
      <output>{term.value}</output>
    </section>
  );
}
