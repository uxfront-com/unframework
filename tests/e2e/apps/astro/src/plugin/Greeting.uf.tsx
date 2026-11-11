import "./Greeting.css";
import type { GreetingProps } from "./types.ts";

export default function Greeting({ name }: GreetingProps) {
  return <h1 class="greeting">Hello from {name}, plugin mode</h1>;
}
