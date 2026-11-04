import Button, {
  type ButtonProps,
  type ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/solid/Button";

// @uf-expect TS2322 Button.type:ButtonProps
const props: ButtonProps = { label: "Save", tone: "danger" };
// @uf-expect TS2322 Button.type:ButtonSize
const size: ButtonSize = "huge";

export function MisuseType() {
  return <Button label={props.label} data-size={size} />;
}
