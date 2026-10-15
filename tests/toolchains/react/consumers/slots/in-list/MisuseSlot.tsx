import Steps from "../../../../../integration/cases/slots/in-list/__output__/react/Steps";

export function MisuseSlot() {
  // @uf-expect TS2322 Steps.slot:marker
  return <Steps steps={["Boil"]} marker={() => "Content"} />;
}
