import Badge from "../../../../../integration/cases/context/static/__output__/react/Badge";

export function MisuseProp() {
  // @uf-expect TS2322 Badge.prop:text
  return <Badge text={1} />;
}
