// The module the props type comes from. `Icon` is declared without `export`, so no output that
// writes the type of `icon` can import it.
interface Icon {
  name: string;
}

export interface CardProps {
  title: string;
  icon?: Icon;
}
