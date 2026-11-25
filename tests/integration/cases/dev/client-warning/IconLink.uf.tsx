import { isDev, onMounted, useTemplateRef } from "@uxfront/unframework";

// A link whose content its parent fills. Only the rendered DOM can say whether it holds a name,
// so a development build checks it once mounted, in client code (ADR-0117).
export default function IconLink({ href, label }: { href: string; label?: string }) {
	const link = useTemplateRef<HTMLAnchorElement>();
	onMounted(() => {
		if (isDev) {
			const name = link.value?.getAttribute("aria-label") ?? link.value?.textContent?.trim();
			if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
		}
	});
	return (
		<a ref={link} href={href} aria-label={label}>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<path d="M2 8h10M8 4l4 4-4 4" />
			</svg>
		</a>
	);
}
