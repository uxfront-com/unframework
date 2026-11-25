import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function SelectRow(
	props: { value: string } & Omit<ComponentProps<"option">, "value" | "style"> & {
			style?: JSX.CSSProperties;
		},
) {
	const [, others] = splitProps(props, ["value"]);

	return (
		<option value={props.value} {...others}>
			{props.value}
		</option>
	);
}
