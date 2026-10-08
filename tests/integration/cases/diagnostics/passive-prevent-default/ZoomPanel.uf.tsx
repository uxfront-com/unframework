// UF3034 passive-prevent-default: the passive `wheel` listener calls `preventDefault()`, which the
// browser ignores there, and which Angular, running the element's two `wheel` listeners as one,
// would let prevent the scroll. The safe fix removes the call.
import { ref } from "unframework";

export default function ZoomPanel() {
  const zoom = ref(1);
  const scrolled = ref(0);

  return (
    <section class="zoom-panel" aria-label="Map">
      <div
        class="zoom-panel__viewport"
        onWheel={(event) => (scrolled.value += event.deltaY)}
        onWheelPassive={(event) => {
          event.preventDefault();
          zoom.value = event.deltaY > 0 ? zoom.value / 2 : zoom.value * 2;
        }}
      >
        <p>
          Zoom {zoom.value}, scrolled {scrolled.value}
        </p>
      </div>
    </section>
  );
}
