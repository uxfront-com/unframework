// The browser project's virtual modules (test/corpus-plugin.ts): a corpus case's Angular
// component, and the events it declares.
declare module "virtual:uf-angular/*" {
  const component: unknown;
  export default component;
}

declare module "virtual:uf-angular-events/*" {
  import type { MountEvent } from "@unframework/codegen";

  const events: MountEvent[];
  export default events;
}
