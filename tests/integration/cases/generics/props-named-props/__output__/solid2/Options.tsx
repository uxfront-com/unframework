import { KeyedFor } from "./_unframework/KeyedFor";
import { enumeratedValue } from "./_unframework/enumeratedValue";

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
            <li
              aria-current={enumeratedValue(option.value === props.selected ? "true" : undefined)}
            >
              {String(option.value)}
            </li>
          )}
        </KeyedFor>
      </ul>
    </>
  );
}
