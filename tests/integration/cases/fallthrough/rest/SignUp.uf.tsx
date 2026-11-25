import { ref } from "@uxfront/unframework";

import Field from "./Field.uf.tsx";

export default function SignUp() {
	const focuses = ref(0);
	return (
		<form aria-label="Sign up">
			<p id="email-hint">We never share it.</p>
			<Field
				label="Email"
				id="email"
				aria-describedby="email-hint"
				placeholder="you@example.com"
				class="wide"
				style="margin-top: 4px"
				onFocus={() => focuses.value++}
			/>
			<p>Focuses: {focuses.value}</p>
		</form>
	);
}
