import Card from "../../../../../integration/cases/slots/presence/__output__/solid/Card";

export function MisuseProp() {
  // @uf-expect TS2322 Card.prop:label
  return <Card label={1} />;
}
