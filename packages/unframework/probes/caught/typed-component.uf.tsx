// What a component branded by the content mapper (TypedComponent) gets: exact props. This simulates
// the mapper's virtual output by hand, so layer 3 stays pinned even before the mapper exists.
import type { TypedComponent } from "unframework";

interface PickerProps {
  label: string;
  // What the mapper would synthesise from defineEmits / defineModel:
  onPick?: (value: number) => void;
  "v-model:open"?: boolean;
}

function PickerImpl(_props: PickerProps) {
  return <div />;
}
const Picker = PickerImpl as typeof PickerImpl & TypedComponent;

export function Exact() {
  return (
    <>
      {/* @ts-expect-error TS2322 a misspelt event is an error once the mapper has typed the component */}
      <Picker label="x" onPik={() => {}} />
      {/* @ts-expect-error TS2322 the model's value type is checked through the declared "v-model:open" */}
      <Picker label="x" v-model:open={42} />
      <Picker label="x" onPick={(value) => value.toFixed()} v-model:open={true} class="ok" />
      {/* Never caught by types, even here: undeclared hyphenated names are exempt (compiler only). */}
      <Picker label="x" v-model:opne={true} />
    </>
  );
}
