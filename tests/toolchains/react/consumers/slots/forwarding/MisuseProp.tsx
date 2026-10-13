import Frame from "../../../../../integration/cases/slots/forwarding/__output__/react/Frame";

export function MisuseProp() {
  // @uf-expect TS2322 Frame.prop:label
  return <Frame label={0} />;
}
