import Card from "../../../../../integration/cases/slots/named/__output__/react/Card";

export function MisuseSlot() {
  // @uf-expect TS2322 Card.slot:header
  return <Card header={() => "Content"} />;
}
