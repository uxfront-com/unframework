import { Teleport } from "@uxfront/unframework";

export interface TipProps {
  label: string;
}

export default function Tip({ label }: TipProps) {
  return (
    <Teleport to="body">
      <p data-teleported class="tip" role="note">
        {label} tip
      </p>
    </Teleport>
  );
}
