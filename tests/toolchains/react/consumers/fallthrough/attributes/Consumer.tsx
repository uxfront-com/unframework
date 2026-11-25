import { useRef, useState } from "react";

import SaveButton from "../../../../../integration/cases/fallthrough/attributes/__output__/react/SaveButton";

export function Consumer() {
	const [pressed, setPressed] = useState(false);
	const save = useRef<HTMLButtonElement>(null);
	return (
		<>
			<SaveButton
				id="save"
				ref={save}
				title="Save"
				type="submit"
				aria-describedby="hint"
				aria-pressed={pressed}
				onClick={(event) => setPressed(!event.defaultPrevented)}
			/>
			<button type="button" onClick={() => save.current?.focus()}>
				Focus
			</button>
		</>
	);
}
