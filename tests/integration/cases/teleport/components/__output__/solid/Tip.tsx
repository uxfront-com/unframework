import { Teleport } from "./_unframework/Teleport";

export interface TipProps {
  label: string;
}

export default function Tip(props: TipProps) {
  return (
    <>
      <Teleport to="body">
        <p data-teleported="true" class="tip" role="note">
          {props.label} tip
        </p>
      </Teleport>
    </>
  );
}
