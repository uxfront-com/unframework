import Legend from "./Legend.uf.tsx";

export default function Chart({ series }: { series: string[] }) {
  return (
    <div>
      <Legend items={series} label="Series">
        {{
          swatch: ({ item }) => <b>{item.slice(0, 1)}</b>,
          caption: ({ item }) => <i>{item}</i>,
        }}
      </Legend>
      <Legend items={series} label="Captions">
        {{ caption: ({ item }) => <span>{item.toUpperCase()}</span> }}
      </Legend>
    </div>
  );
}
