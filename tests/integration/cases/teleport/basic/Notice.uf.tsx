import { Teleport, ref } from "@uxfront/unframework";

export interface NoticeProps {
	message: string;
}

export default function Notice({ message }: NoticeProps) {
	const dismissed = ref(0);

	return (
		<section class="inbox" aria-label="Inbox">
			<p>Dismissed {dismissed.value} times</p>
			<Teleport to="body">
				<div data-teleported class="notice">
					<p role="status">
						{message} ({dismissed.value})
					</p>
					<button type="button" onClick={() => dismissed.value++}>
						Dismiss
					</button>
				</div>
			</Teleport>
		</section>
	);
}
