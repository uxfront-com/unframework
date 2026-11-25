export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

export default function Excerpt({ title, text, fill, stroke }: ExcerptProps) {
  return (
    <article class="excerpt">
      <h2
        style={{
          WebkitTextFillColor: fill,
          WebkitTextStrokeColor: stroke,
          WebkitTextStrokeWidth: "1px",
          color: "rgb(0, 0, 0)",
        }}
      >
        {title}
      </h2>
      <p style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; width: 240px">
        {text}
      </p>
    </article>
  );
}
