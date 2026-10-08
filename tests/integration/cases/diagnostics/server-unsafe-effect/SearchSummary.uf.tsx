// UF2013 server-unsafe-effect: an immediate watcher's first callback runs with the setup, on the
// server too on Vue, so it must not write state. Derive the heading with `computed`, or write it
// from `onMounted` and a watcher without `immediate`.
import { ref, watch } from "unframework";

export interface SearchSummaryProps {
  query: string;
}

export default function SearchSummary({ query }: SearchSummaryProps) {
  const heading = ref("");

  watch(
    () => query,
    (value) => {
      heading.value = `Results for ${value}`;
    },
    { immediate: true },
  );

  return <h2 class="search-summary">{heading.value}</h2>;
}
