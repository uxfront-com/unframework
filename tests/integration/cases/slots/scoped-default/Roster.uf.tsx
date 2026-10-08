import Names from "./Names.uf.tsx";

export default function Roster({ names }: { names: string[] }) {
  return <Names names={names}>{{ default: ({ item }) => <b>{item}!</b> }}</Names>;
}
