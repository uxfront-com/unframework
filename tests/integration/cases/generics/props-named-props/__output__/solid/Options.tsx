import { For } from "solid-js";

interface Props<T> {
  heading: string;
  options: T[];
  selected?: T;
}

export default function Options<T>(props: Props<T>) {
  return (
    <>
      <h2>{props.heading}</h2>
      <ul aria-label={props.heading}>
        <For each={props.options}>
          {(option) => (
            <li aria-current={option === props.selected ? "true" : undefined}>{String(option)}</li>
          )}
        </For>
      </ul>
    </>
  );
}
