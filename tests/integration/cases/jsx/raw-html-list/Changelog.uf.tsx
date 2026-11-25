export interface Entry {
	id: number;
	html: string;
}

export interface ChangelogProps {
	entries: Entry[];
}

export default function Changelog({ entries }: ChangelogProps) {
	return (
		<ul class="changelog">
			{entries.map((entry) => (
				<li key={entry.id} innerHTML={entry.html} />
			))}
		</ul>
	);
}
