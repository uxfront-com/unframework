import Card from "../../../../../integration/cases/slots/named/__output__/solid2/Card";

export function MisuseSlot() {
  return (
    <Card
      // @uf-expect TS2322 Card.slot:header
      header={(props: { size: number }) => props.size}
    />
  );
}
