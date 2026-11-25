// The root element: a button with a class of its own.
export default function Pressable({ text }: { text: string }) {
	return (
		<button type="button" class="pressable">
			{text}
		</button>
	);
}
