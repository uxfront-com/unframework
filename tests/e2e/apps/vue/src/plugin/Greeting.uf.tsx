import "./Greeting.css";
import type { GreetingProps } from "./types";

export default function Greeting({ name }: GreetingProps) {
  return <p class="greeting">Hello, {name}</p>;
}
