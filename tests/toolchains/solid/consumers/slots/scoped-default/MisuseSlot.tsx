import Names from "../../../../../integration/cases/slots/scoped-default/__output__/solid/Names";

export function MisuseSlot() {
  return (
    <Names
      names={["Ada"]}
      // @uf-expect TS2339 Names.slot:default
      children={({ size }) => size}
    />
  );
}
