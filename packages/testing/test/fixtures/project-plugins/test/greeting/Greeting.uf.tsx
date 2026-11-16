import { greeting } from "virtual:uf-fixture";

export default function Greeting({ tone }: { tone?: "plain" | "warm" }) {
  return <p class={greeting(tone)}>Hello</p>;
}
