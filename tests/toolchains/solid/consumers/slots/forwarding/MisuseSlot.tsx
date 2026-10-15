import Frame from "../../../../../integration/cases/slots/forwarding/__output__/solid/Frame";

export function MisuseSlot() {
  return (
    <Frame
      label="Shot"
      // @uf-expect TS2322 Frame.slot:title
      title={(props: { size: number }) => props.size}
    />
  );
}
