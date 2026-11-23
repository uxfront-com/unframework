import Component from "@glimmer/component";
import Base, { type BaseEvents, type BaseSignature } from "./Base.gts";

export interface PrimaryEvents {
  onPress?: () => void;
}

export interface PrimarySignature {
  Args: { href?: string; disabled?: boolean; text: string } & { style?: unknown } & PrimaryEvents;
  Element: BaseSignature["Element"];
}

export default class Primary extends Component<PrimarySignature> {
  listener1 = (() => this.args.onPress?.()) satisfies NonNullable<BaseEvents["onPress"]>;

  <template><Base
      @href={{@href}}
      @disabled={{@disabled}}
      @text={{@text}}
      @onPress={{this.listener1}}
      class="primary"
      @style={{@style}}
      ...attributes
    /></template>
}
