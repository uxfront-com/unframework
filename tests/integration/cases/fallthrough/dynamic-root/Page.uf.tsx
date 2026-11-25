import { ref } from "@uxfront/unframework";

import "./Page.css";
import Base from "./Base.uf.tsx";
import Primary from "./Primary.uf.tsx";

export default function Page() {
	const linked = ref(true);
	const tone = ref("rgb(29, 78, 216)");
	const pressed = ref("none");
	const items = ref([
		{ id: 1, href: "#one", disabled: true, label: "One" },
		{ id: 2, href: "", disabled: true, label: "Two" },
	]);
	return (
		<section class="page">
			<Primary
				href={linked.value ? "#docs" : undefined}
				disabled={true}
				text="Docs"
				class="wide"
				style={{ color: tone.value }}
				onPress={() => (pressed.value = "docs")}
			/>
			<Base
				disabled={true}
				text="Off"
				class={["off", { muted: !linked.value }]}
				onPress={() => (pressed.value = "off")}
			/>
			<Base text="Save" class="save" onPress={() => (pressed.value = "save")} />
			<ul aria-label="Items">
				{items.value.map((item) => (
					<li key={item.id}>
						<component
							is={item.href ? "a" : "button"}
							href={item.href}
							disabled={item.disabled}
							class="item"
						>
							{item.label}
						</component>
					</li>
				))}
			</ul>
			<button
				type="button"
				onClick={() => {
					linked.value = !linked.value;
					tone.value = linked.value ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)";
				}}
			>
				Toggle
			</button>
			<output>{pressed.value}</output>
		</section>
	);
}
