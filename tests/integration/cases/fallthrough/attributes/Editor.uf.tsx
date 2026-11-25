import { ref } from "@uxfront/unframework";

import SaveButton from "./SaveButton.uf.tsx";

export default function Editor() {
	const pressed = ref(false);
	return (
		<div class="editor">
			<p id="save-hint">Saves the draft.</p>
			<SaveButton
				title="Save"
				id="save"
				aria-describedby="save-hint"
				aria-pressed={pressed.value}
				data-testid="save-button"
				type="submit"
				class="primary"
			/>
			<button type="button" onClick={() => (pressed.value = !pressed.value)}>
				Toggle
			</button>
		</div>
	);
}
