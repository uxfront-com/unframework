import { defineOptions } from "@uxfront/unframework";

// Turns fallthrough off and spreads what its consumer passes on its <input>, not on its root.
export default function Field({ label, ...rest }: { label: string }) {
	defineOptions({ inheritAttrs: false });
	return (
		<label class="field">
			{label} <input {...rest} name={label.toLowerCase()} />
		</label>
	);
}
