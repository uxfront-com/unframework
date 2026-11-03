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
