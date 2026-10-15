import Field from "../../../../../integration/cases/components/props-and-events/__output__/react/Field";

function clear(label: string): string {
  return label.toUpperCase();
}

export function Consumer() {
  return <Field label="Street" tone="warn" onClear={clear} />;
}
