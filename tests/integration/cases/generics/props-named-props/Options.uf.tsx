// A generic component whose own props interface is named `Props` (ADR-0068): the outputs keep the
// name, and Astro, which declares a `Props` of its own, renames the source's `OwnProps`. Its two
// roots take no fallthrough, so Astro's `Props` is an alias of it, `type Props<T> = OwnProps<T>;`.
interface Props<T> {
  heading: string;
  options: T[];
  selected?: T;
}

export default function Options<T>({ heading, options, selected }: Props<T>) {
  return (
    <>
      <h2>{heading}</h2>
      <ul aria-label={heading}>
        {options.map((option, index) => (
          <li key={index} aria-current={option === selected ? "true" : undefined}>
            {String(option)}
          </li>
        ))}
      </ul>
    </>
  );
}
