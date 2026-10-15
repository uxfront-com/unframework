import Field from "../../../../../integration/cases/components/props-and-events/__output__/react/Field";

export function MisuseEvent() {
  // @uf-expect TS2322 Field.event:clear
  return <Field label="Street" onClear={(count: number) => count + 1} />;
}
