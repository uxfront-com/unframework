import Notice from "../../../../../integration/cases/slots/fallback/__output__/solid/Notice";

export function MisuseSlot() {
  return (
    <Notice
      label="Build"
      // @uf-expect TS2322 Notice.slot:action
      action={(props: { size: number }) => props.size}
    />
  );
}
