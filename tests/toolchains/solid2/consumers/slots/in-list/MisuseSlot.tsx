import Steps from "../../../../../integration/cases/slots/in-list/__output__/solid2/Steps";

export function MisuseSlot() {
  return (
    <Steps
      steps={["Boil"]}
      // @uf-expect TS2322 Steps.slot:marker
      marker={(props: { size: number }) => props.size}
    />
  );
}
