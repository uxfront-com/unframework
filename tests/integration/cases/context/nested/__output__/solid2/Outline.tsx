import Level from "./Level";
import type { ComponentProps } from "@solidjs/web";

export default function Outline(props: Omit<ComponentProps<typeof Level>, "children" | "title">) {
  return (
    <Level title="Book" {...props}>
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
  );
}
