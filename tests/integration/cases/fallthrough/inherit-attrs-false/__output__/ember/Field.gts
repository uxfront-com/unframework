import Component from "@glimmer/component";

export interface FieldSignature {
  Args: { label: string };
  Element: HTMLElementTagNameMap["label"];
}

export default class Field extends Component<FieldSignature> {
  get value1() {
    return this.args.label.toLowerCase();
  }

  <template><label class="field">{{@label}} <input name={{this.value1}}></label></template>
}
