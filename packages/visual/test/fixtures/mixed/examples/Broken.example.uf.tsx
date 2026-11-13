// Imports the authoring API from a name it doesn't have: UF1002 on every target.
import { onMounted } from "unframework";

export default function Broken() {
  onMounted(() => {});
  return <p>Broken</p>;
}
