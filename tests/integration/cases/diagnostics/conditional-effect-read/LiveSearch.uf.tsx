// UF2015 conditional-effect-read: the effect reads `query` only while `live` is on, so a target
// that lists an effect's dependencies statically (React, Qwik's `track`) would miss it. Read every
// value first, or `watch` explicit sources.
import { defineEmits, ref, watchEffect } from "unframework";

export default function LiveSearch() {
  const emit = defineEmits<{ search: [query: string] }>();

  const live = ref(true);
  const query = ref("");

  watchEffect(() => {
    const enabled = live.value;
    if (enabled) {
      emit("search", query.value);
    }
  });

  return (
    <div class="live-search">
      <input
        name="query"
        aria-label="Search"
        onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
      />
      <button type="button" aria-pressed={live.value} onClick={() => (live.value = !live.value)}>
        Search as I type
      </button>
    </div>
  );
}
