// UF2003 reserved-prop-name: `key` cannot be a prop name: React and Vue read it as a list key
// and never pass it to the component.
export interface TabProps {
  key: string;
  label: string;
}

export default function Tab({ key, label }: TabProps) {
  return <button type="button">{label}</button>;
}
