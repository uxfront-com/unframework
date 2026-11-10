import "./Greeting.css";
import type { GreetingProps } from "./types.ts";

export default function Greeting({ name }: GreetingProps) {
  return <p class="greeting">Hello, {name}</p>;
}
