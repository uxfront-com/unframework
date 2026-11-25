import { useRef, useState } from "react";

import NameField from "../../../../../integration/cases/fallthrough/root-ref/__output__/react/NameField";

export function Consumer() {
	const [clicks, setClicks] = useState(0);
	const field = useRef<HTMLInputElement>(null);
	return (
		<>
			<p id="name-hint">Hint {clicks}</p>
			<NameField
				id="name"
				ref={field}
				label="Name"
				aria-describedby="name-hint"
				placeholder="Ada"
				onClick={(event) => setClicks(clicks + event.detail)}
			/>
			<button type="button" onClick={() => field.current?.focus()}>
				Focus
			</button>
		</>
	);
}
