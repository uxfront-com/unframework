import Toast from "./Toast.uf.tsx";

import "./Page.css";

export interface PageProps {
	message: string;
}

export default function Page({ message }: PageProps) {
	return (
		<section class="page" aria-label="Page">
			<p>Saving…</p>
			<Toast message={message} />
		</section>
	);
}
