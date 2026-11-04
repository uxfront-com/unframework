import { useToggle } from "./useToggle.uf.ts";

export default function Toggle() {
  const { on, toggle } = useToggle(false);
  return <button onClick={() => toggle()}>{on.value ? "On" : "Off"}</button>;
}
