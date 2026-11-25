// Declares one prop, `title`, which it renders as text: a declared prop never falls through.
export default function SaveButton({ title }: { title: string }) {
	return (
		<button type="button" class="button">
			{title}
		</button>
	);
}
