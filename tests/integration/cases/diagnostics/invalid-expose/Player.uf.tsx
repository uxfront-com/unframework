// UF2030 invalid-expose: a component exposes its local functions by name; `volume` is state.
import { defineExpose, ref } from "unframework";

export default function Player({ src }: { src: string }) {
  const volume = ref(1);
  function play() {
    volume.value = 1;
  }
  defineExpose({ play, volume });
  return <audio src={src} />;
}
