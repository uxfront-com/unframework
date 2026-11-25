import { onMounted, ref, useTemplateRef } from "@uxfront/unframework";

// Exposes nothing, so a ref on it holds its root element. Its own template ref on that element
// still holds it once mounted, beside the parent's: `onMounted` reads it, and its focus listener
// fills the field only if it did.
export default function NameField({ label }: { label: string }) {
	const input = useTemplateRef<HTMLInputElement>();
	const mounted = ref(false);
	onMounted(() => {
		mounted.value = input.value !== null;
	});
	function fill() {
		if (input.value && !input.value.value && mounted.value) input.value.value = "Ada";
	}
	return <input ref={input} name="name" aria-label={label} onFocus={fill} />;
}
