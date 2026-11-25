import Badge from "../src/Badge.uf.tsx";
import Box from "../src/Box.uf.tsx";
import Flag from "../src/Flag.uf.tsx";
import Plain from "../src/Plain.uf.tsx";

export default function Flags() {
	return (
		<div>
			<Badge text="first" />
			<Flag label="warned" tone="warn" />
			<Flag label="bare" />
			<Box>
				<Flag label="nested" />
			</Box>
			<Badge text="second" />
			<component is={Flag} label="dynamic" />
			<Plain />
		</div>
	);
}
