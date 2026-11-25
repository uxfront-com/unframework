import { defineEmits } from "@uxfront/unframework";

export type Source =
	| { kind: "link"; id: string; title: string; href: string }
	| { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
	sources: Source[];
}

export default function Reading({ sources }: ReadingProps) {
	const emit = defineEmits<{ open: [href: string] }>();

	return (
		<ul class="reading" aria-label="Reading list">
			{sources.map((source, index) => (
				<li key={source.id} title={source.kind === "link" ? source.href : source.title}>
					{index + 1}. {source.title}
					{source.kind === "book" && source.note ? ` (${source.note.trim()})` : ""}
					{source.kind === "link" && (
						<button type="button" onClick={() => emit("open", source.href)}>
							{`Open ${source.title}`}
						</button>
					)}
				</li>
			))}
		</ul>
	);
}
