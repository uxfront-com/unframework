import Panel from "../../../../../integration/cases/slots/default/__output__/solid/Panel";

export function MisuseSlot() {
  return (
    <Panel
      title="Hello"
      // @uf-expect TS2322 Panel.slot:default
      children={(props: { size: number }) => props.size}
    />
  );
}
