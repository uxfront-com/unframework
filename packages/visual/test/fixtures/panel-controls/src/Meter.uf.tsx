export default function Meter({
	value,
	labelPosition,
	showValueWhenEmpty,
	caption,
	steps,
}: {
	value: number;
	labelPosition?: "start" | "end" | "above" | "below";
	showValueWhenEmpty?: boolean;
	caption?: string;
	steps?: 1 | 2 | 3;
}) {
	return (
		<span
			data-meter={value}
			data-label={labelPosition}
			data-empty={showValueWhenEmpty ? "yes" : "no"}
			data-steps={steps}
		>
			{caption}
		</span>
	);
}
