// UF3016 non-text-interpolation: a boolean interpolated as text; write `done ? "Done" : "Open"`.
export interface TaskRowProps {
  title: string;
  done: boolean;
}

export default function TaskRow({ title, done }: TaskRowProps) {
  return (
    <p>
      {title}: {done}
    </p>
  );
}
