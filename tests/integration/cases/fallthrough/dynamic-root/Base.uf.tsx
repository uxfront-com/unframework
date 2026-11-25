import { defineEmits } from "@uxfront/unframework";

// Its root is a `<component is>` over tags: a link with an `href`, and a button without one.
// `href` renders only on the link and `disabled` only on the button (ADR-0119).
export default function Base({
	href,
	disabled,
	text,
}: {
	href?: string;
	disabled?: boolean;
	text: string;
}) {
	const emit = defineEmits<{ press: [] }>();
	// The page handles a press, as a router would: the link does not navigate.
	function press(event: MouseEvent) {
		event.preventDefault();
		emit("press");
	}
	return (
		<component
			is={href ? "a" : "button"}
			href={href}
			disabled={disabled}
			class="base"
			style="padding: 4px 8px"
			onClick={press}
		>
			{text}
		</component>
	);
}
