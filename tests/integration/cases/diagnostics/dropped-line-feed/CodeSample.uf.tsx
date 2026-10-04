// UF3017 dropped-line-feed: the HTML parser drops a line feed at the start of a <pre>, so
// server-rendered HTML would lose the line break that a client render keeps.
export default function CodeSample() {
  return <pre>{"\nconst answer = 42;"}</pre>;
}
