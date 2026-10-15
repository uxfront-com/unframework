import Names from "../../../../../integration/cases/slots/scoped-default/__output__/react/Names";

export function MisuseSlot() {
  // @uf-expect TS2339 Names.slot:default
  return <Names names={["Ada"]} renderDefault={({ size }) => size} />;
}
