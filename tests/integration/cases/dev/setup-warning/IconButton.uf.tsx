import { isDev } from "@uxfront/unframework";

// A button that shows only an icon, so its `label` is its accessible name. A development build
// warns its author when it has none, and a production build drops the check (ADR-0117).
export default function IconButton({ label }: { label?: string }) {
	if (isDev) {
		if (!label) console.warn("IconButton has no accessible name: pass it a `label`.");
	}
	return (
		<button type="button" aria-label={label}>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" />
			</svg>
		</button>
	);
}
