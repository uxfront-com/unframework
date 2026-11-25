import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface AddressProps {
	name: string;
	street: string;
	city?: string;
}

export default function Address(
	props: AddressProps &
		Omit<ComponentProps<"pre">, "name" | "street" | "city" | "style"> & {
			style?: JSX.CSSProperties;
		},
) {
	const [, others] = splitProps(props, ["name", "street", "city"]);

	return (
		<pre {...others}>
			{props.name}
			{["\n"]}
			{props.street}
			{["\n"]}
			{props.city ?? "-"}
		</pre>
	);
}
