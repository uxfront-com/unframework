import { defineEmits, onMounted, useId, useTemplateRef } from "@uxfront/unframework";

export interface ConfirmDialogProps {
	title: string;
}

export default function ConfirmDialog({ title }: ConfirmDialogProps) {
	const emit = defineEmits<{ confirm: []; close: [] }>();
	const titleId = useId();
	const cancel = useTemplateRef<HTMLButtonElement>();

	// Inside the teleport, so its element is in the document when this runs (ADR-0098).
	onMounted(() => {
		cancel.value?.focus();
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") emit("close");
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			tabindex="-1"
			class="dialog"
			onKeydown={onKeydown}
		>
			<h2 id={titleId}>{title}</h2>
			<button type="button" ref={cancel} onClick={() => emit("close")}>
				Cancel
			</button>
			<button type="button" onClick={() => emit("confirm")}>
				Delete
			</button>
		</div>
	);
}
