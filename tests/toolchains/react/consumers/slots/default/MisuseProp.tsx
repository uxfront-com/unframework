import Panel from "../../../../../integration/cases/slots/default/__output__/react/Panel";

export function MisuseProp() {
  // @uf-expect TS2322 Panel.prop:title
  return <Panel title={7} />;
}
