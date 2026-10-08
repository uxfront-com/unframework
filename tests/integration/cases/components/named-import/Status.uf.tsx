import { Badge, Pill as Tag } from "./Badges.uf.tsx";

export default function Status({ state }: { state: string }) {
  return (
    <p class="status">
      <Badge text="Build" />
      <Tag text={state} />
    </p>
  );
}
