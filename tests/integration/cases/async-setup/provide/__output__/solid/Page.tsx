import Badge from "./Badge";
import Panel from "./Panel";
import type { ComponentProps, JSX } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"main">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <main {...props}>
      <Panel id="ada">
        <Badge />
      </Panel>
    </main>
  );
}
