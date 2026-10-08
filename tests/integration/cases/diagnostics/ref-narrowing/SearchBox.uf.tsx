// UF3031 ref-narrowing: `if (typeof query.value === "string") emit("search", query.value.trim())`
// relies on TypeScript narrowing the ref's union of kinds between two reads, which Solid's and
// Angular's reads (calls) do not keep; the likely fix reads it into a local first.
import { defineEmits, ref } from "unframework";

export default function SearchBox() {
  const query = ref<string | string[]>("");
  const emit = defineEmits<{ search: [text: string] }>();

  function submit() {
    if (typeof query.value === "string") emit("search", query.value.trim());
  }

  return (
    <div class="search-box">
      <input name="query" aria-label="Search" />
      <button type="button" onClick={submit}>
        Search
      </button>
    </div>
  );
}
