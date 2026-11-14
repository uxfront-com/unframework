// `innerHTML` on a component: a component renders its own content, and takes the props it
// declares, so markup is set on one of its elements, with a prop that passes the markup in.
function Card({ heading }: { heading: string }) {
  return (
    <section class="card">
      <h2>{heading}</h2>
    </section>
  );
}

export interface PageProps {
  intro: string;
}

export default function Page({ intro }: PageProps) {
  return <Card heading="Welcome" innerHTML={intro} />;
}
