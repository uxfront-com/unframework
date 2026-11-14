// UF3053 teleport-target: `<Teleport to>` takes a static CSS selector, so a bound `to` and an
// empty one are rejected at the attribute.
import { Teleport } from "@uxfront/unframework";

export interface OverlayProps {
  target: string;
}

export default function Overlay({ target }: OverlayProps) {
  return (
    <section>
      <Teleport to={target}>
        <div class="overlay">Bound</div>
      </Teleport>
      <Teleport to="">
        <div class="overlay">Empty</div>
      </Teleport>
    </section>
  );
}
