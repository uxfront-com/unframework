import Button from "../../../../../integration/cases/types/exported-types/__output__/react/Button";
import type {
	ButtonProps,
	ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/react/Button";

export function Consumer() {
	const props: ButtonProps = { label: "Save", tone: "secondary" };
	const size: ButtonSize = "large";
	return <Button label={props.label} tone={props.tone} data-size={size} />;
}
