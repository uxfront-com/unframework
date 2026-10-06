// UF3020 unresolved-reference: `lable` is no prop, loop variable or allowed global (a misspelt
// `label`).
export interface GreetingProps {
  label: string;
}

export default function Greeting({ label }: GreetingProps) {
  return <h2 title={label}>{lable}</h2>;
}
