import Notice from "./Notice.uf.tsx";

export default function Board({ build }: { build: string }) {
  return (
    <div>
      <Notice label="Build">
        {{
          default: () => <>Build {build} failed.</>,
          action: () => <a href="#logs">See the logs</a>,
        }}
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}
