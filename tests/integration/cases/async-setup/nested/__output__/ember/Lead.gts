import type { TOC } from "@ember/component/template-only";
import Member, { type MemberSignature } from "./Member.gts";

export interface LeadSignature {
  Args: { id: string } & { style?: unknown };
  Element: MemberSignature["Element"];
}

const Lead: TOC<LeadSignature> = <template><Member @id={{@id}} @style={{@style}} ...attributes /></template>;

export default Lead;
