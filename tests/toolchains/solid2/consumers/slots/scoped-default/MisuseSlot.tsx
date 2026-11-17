import Names from "../../../../../integration/cases/slots/scoped-default/__output__/solid2/Names";

export function MisuseSlot() {
  return (
    <Names
      names={["Ada"]}
      // @uf-expect TS2339 Names.slot:default
      children={({ size }) => size}
    />
  );
}
