import Disclosure from "../../../../../integration/cases/semantics/models/__output__/react/Disclosure";

export function MisuseProp() {
  // @uf-expect TS2322 Disclosure.prop:title
  return <Disclosure title={1} />;
}
