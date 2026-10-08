import { useTemplateRef } from "unframework";

import SearchField from "./SearchField.uf.tsx";

export default function Header() {
  const search = useTemplateRef<{ focus(): void }>();
  return (
    <header class="header">
      <SearchField ref={search} label="Find" />
      <button type="button" onClick={() => search.value?.focus()}>
        Search
      </button>
    </header>
  );
}
