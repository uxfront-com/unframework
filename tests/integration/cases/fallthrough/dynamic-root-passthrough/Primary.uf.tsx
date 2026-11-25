import Base from "./Base.uf.tsx";

// Its root is a component: what falls through to it passes on to whichever tag Base renders.
export default function Primary({ href, text }: { href?: string; text: string }) {
	return <Base href={href} text={text} class="primary" />;
}
