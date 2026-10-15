import Frame from "../../../../../integration/cases/slots/forwarding/__output__/react/Frame";

export function MisuseSlot() {
  // @uf-expect TS2322 Frame.slot:title
  return <Frame label="Shot" title={() => "Content"} />;
}
