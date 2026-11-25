import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function SelectRow(
	props: { value: string } & Omit<ComponentProps<"option">, "value" | "class" | "style"> & {
			class?: string;
			style?: JSX.CSSProperties;
		},
) {
	const others = omit(props, "value");

	return (
		<option value={props.value} {...others}>
			{props.value}
		</option>
	);
}
