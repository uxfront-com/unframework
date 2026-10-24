// Props types written in the module that uses them.

interface CardProps {
  title: string;
  count: number;
}

type Tree = { label: string; children: Tree[] };

export function Literal(props: { label: string; count?: number; tags: readonly string[] }) {
  return props;
}

export function Declared(props: CardProps) {
  return props;
}

export function Unions(props: {
  value: string | number | null;
  onChange: (value: string) => void;
}) {
  return props;
}

export function Emits(events: { change: [value: string]; close: [] }) {
  return events;
}

export function List<T>(props: { items: T[]; selected?: T }) {
  return props;
}

export function Recursive(props: Tree) {
  return props;
}
