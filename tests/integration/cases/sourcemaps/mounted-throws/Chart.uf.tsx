import { onMounted } from "unframework";

export default function Chart() {
  onMounted(() => {
    throw new Error("The chart could not start");
  });

  return <p>Chart</p>;
}
