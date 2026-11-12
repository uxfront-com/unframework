import { onMounted } from "@uxfront/unframework";

export default function Noisy() {
  onMounted(() => {
    console.error("noisy example");
  });
  return <p>Noisy</p>;
}
