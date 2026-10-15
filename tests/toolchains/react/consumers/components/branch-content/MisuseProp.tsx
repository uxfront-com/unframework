import Notice from "../../../../../integration/cases/components/branch-content/__output__/react/Notice";

export function MisuseProp() {
  // @uf-expect TS2322 Notice.prop:tone
  return <Notice text="Saved" tone="loud" />;
}
