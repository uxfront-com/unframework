import { KeyedFor } from "./_unframework/KeyedFor";

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
        <KeyedFor each={props.options} by={(option, index) => index}>
          {(option) => (
            <li aria-current={option.value === props.selected ? "true" : undefined}>
              {String(option.value)}
            </li>
          )}
        </KeyedFor>
      </ul>
    </>
  );
}
