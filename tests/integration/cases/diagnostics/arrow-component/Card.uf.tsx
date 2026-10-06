// UF1102 invalid-component: a component written as an arrow function; the likely fix rewrites it
// as a function declaration, the one form a component takes.
export interface CardProps {
  title: string;
}

export const Card = ({ title }: CardProps) => <article class="card">{title}</article>;
