// Consumers of `Badge` import the badge's tones from it. The component itself reads none of them,
// so the re-export is its only link to `tone.ts`, which every output tree still needs.
export type { Tone } from "./tone";

export default function Badge({ label }: { label: string }) {
  return <span class="badge">{label}</span>;
}
