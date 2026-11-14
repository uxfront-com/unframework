// `innerHTML` on `<component is>` (UF1002, ADR-0097): Vue writes a `<component is>` as a
// component, which `v-html` may not be on. Each tag is written in a conditional instead.
export interface SectionProps {
  nested: boolean;
  title: string;
}

export default function Section({ nested, title }: SectionProps) {
  return <component is={nested ? "h3" : "h2"} class="title" innerHTML={title} />;
}
