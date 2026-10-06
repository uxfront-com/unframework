// UF3017 dropped-line-feed: the HTML parser drops a line feed at the start of a <pre>, so
// server-rendered HTML would lose the line break that a client render keeps. A text after a
// conditional that renders nothing starts the <pre> too, where React's and Astro's servers write
// nothing before it.
export default function CodeSample({ caption }: { caption?: string }) {
  return (
    <figure>
      <pre>{"\nconst answer = 42;"}</pre>
      <pre>
        {caption && <b>{caption}</b>}
        {"\nconst question = 6 * 7;"}
      </pre>
    </figure>
  );
}
