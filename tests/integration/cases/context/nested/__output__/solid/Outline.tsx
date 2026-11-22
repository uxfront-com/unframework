import Level from "./Level";
import type { ComponentProps } from "solid-js";

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
