import Member from "./Member.uf.tsx";

// A sync component whose whole render is an async child: the class its parent passes falls
// through to the child's root.
export default function Lead({ id }: { id: string }) {
	return <Member id={id} />;
}
