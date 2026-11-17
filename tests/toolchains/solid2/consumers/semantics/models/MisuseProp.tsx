import Disclosure from "../../../../../integration/cases/semantics/models/__output__/solid2/Disclosure";

export function MisuseProp() {
  // @uf-expect TS2322 Disclosure.prop:title
  return <Disclosure title={1} />;
}
