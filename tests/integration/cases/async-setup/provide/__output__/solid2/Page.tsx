import Badge from "./Badge";
import Panel from "./Panel";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Page(
  props: Omit<ComponentProps<"main">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <main {...props}>
      <Panel id="ada">
        <Badge />
      </Panel>
    </main>
  );
}
