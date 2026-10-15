import SearchField from "../../../../../integration/cases/expose/focus/__output__/react/SearchField";

export function MisuseProp() {
  // @uf-expect TS2322 SearchField.prop:label
  return <SearchField label={null} />;
}
