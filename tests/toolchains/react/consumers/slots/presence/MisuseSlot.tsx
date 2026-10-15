import Card from "../../../../../integration/cases/slots/presence/__output__/react/Card";

export function MisuseSlot() {
  // @uf-expect TS2322 Card.slot:title
  return <Card label="Weather" title={() => "Content"} />;
}
