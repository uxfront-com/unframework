import Notice from "../../../../../integration/cases/slots/fallback/__output__/solid/Notice";

export function MisuseProp() {
  // @uf-expect TS2322 Notice.prop:label
  return <Notice label={1} />;
}
