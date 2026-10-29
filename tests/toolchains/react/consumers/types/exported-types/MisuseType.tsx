import Button, {
  type ButtonProps,
  type ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/react/Button";

export function MisuseType() {
  // @uf-expect TS2322 Button.type:ButtonProps
  const props: ButtonProps = { label: "Save", tone: "danger" };
  // @uf-expect TS2322 Button.type:ButtonSize
  const size: ButtonSize = "huge";
  return <Button label={props.label} data-size={size} />;
}
