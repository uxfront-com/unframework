import { Teleport, defineEmits, ref } from "@uxfront/unframework";

import ConfirmDialog from "./ConfirmDialog.uf.tsx";

export interface FilesProps {
	file: string;
}

export default function Files({ file }: FilesProps) {
	const emit = defineEmits<{ delete: [file: string] }>();
	const open = ref(false);

	function confirm() {
		open.value = false;
		emit("delete", file);
	}

	return (
		<section class="files" aria-label="Files">
			<p>{file}</p>
			<button type="button" onClick={() => (open.value = true)}>
				Delete {file}
			</button>
			{open.value && (
				<Teleport to="body">
					<div data-teleported class="backdrop">
						<ConfirmDialog
							title={`Delete ${file}?`}
							onConfirm={confirm}
							onClose={() => (open.value = false)}
						/>
					</div>
				</Teleport>
			)}
		</section>
	);
}
