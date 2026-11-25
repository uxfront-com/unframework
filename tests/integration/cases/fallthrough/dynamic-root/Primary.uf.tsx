import { defineEmits } from "@uxfront/unframework";

import Base from "./Base.uf.tsx";

// Its root is a component: a class passed to it passes on to whichever tag that component renders.
export default function Primary({
	href,
	disabled,
	text,
}: {
	href?: string;
	disabled?: boolean;
	text: string;
}) {
	const emit = defineEmits<{ press: [] }>();
	return (
		<Base
			href={href}
			disabled={disabled}
			text={text}
			class="primary"
			onPress={() => emit("press")}
		/>
	);
}
