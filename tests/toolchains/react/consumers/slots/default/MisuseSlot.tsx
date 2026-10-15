import Panel from "../../../../../integration/cases/slots/default/__output__/react/Panel";

export function MisuseSlot() {
  // @uf-expect TS2322 Panel.slot:default
  return <Panel title="Hello">{() => "Content"}</Panel>;
}
