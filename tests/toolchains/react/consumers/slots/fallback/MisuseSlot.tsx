import Notice from "../../../../../integration/cases/slots/fallback/__output__/react/Notice";

export function MisuseSlot() {
  // @uf-expect TS2322 Notice.slot:action
  return <Notice label="Build" action={() => "Content"} />;
}
