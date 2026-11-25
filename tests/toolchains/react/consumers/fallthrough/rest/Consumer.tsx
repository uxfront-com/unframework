import { useRef, useState } from "react";

import Field from "../../../../../integration/cases/fallthrough/rest/__output__/react/Field";

export function Consumer() {
	const [clicks, setClicks] = useState(0);
	// The ref holds the root, the <label>, not the <input> the rest lands on.
	const field = useRef<HTMLLabelElement>(null);
	return (
		<>
			<p id="email-hint">Hint {clicks}</p>
			<Field
				id="email"
				ref={field}
				label="Email"
				aria-describedby="email-hint"
				placeholder="you@example.com"
				onClick={(event) => setClicks(clicks + event.detail)}
			/>
			<button type="button" onClick={() => field.current?.focus()}>
				Focus
			</button>
		</>
	);
}
