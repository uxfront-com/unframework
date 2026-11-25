import { vMark } from "./mark.uf.ts";

export interface TagProps {
	name: string;
}

export default function Tag({ name }: TagProps) {
	return (
		<em class="tag" v-mark={`tag ${name}`}>
			#{name}
		</em>
	);
}
