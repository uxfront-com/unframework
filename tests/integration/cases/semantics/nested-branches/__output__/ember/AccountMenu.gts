import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

export interface AccountMenuEvents {
  onGreeted?: (name: string) => void;
}

export interface AccountMenuSignature {
  Args: AccountMenuProps & { style?: unknown } & AccountMenuEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class AccountMenu extends Component<AccountMenuSignature> {
  start = () => {
    this.step = "account";
  };

  signIn = () => {
    this.user = { name: "Ada" };
  };

  signOut = () => {
    this.user = null;
  };

  greet = (name: string) => {
    this.args.onGreeted?.(name);
  };

  @tracked step = "intro";

  @tracked user: User | null = null;

  get value1() {
    return this.step === "intro";
  }

  get value2() {
    return this.user === null;
  }

  get value3() {
    return this.user !== null;
  }

  get value4() {
    return this.user !== null ? this.user.name : undefined;
  }

  get value5() {
    return this.args.owner ? `Greet ${this.args.owner.name}` : undefined;
  }

  listener1 = () => {
    if (!this.args.owner) return;
    return this.greet(this.args.owner.name);
  };

  <template><section
      class="account-menu"
      aria-label="Account"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if this.value1}}<button type="button" {{on "click" this.start}}>Start</button>{{else}}{{#if this.value2}}<button
      type="button"
      {{on "click" this.signIn}}
    >Sign in</button>{{else}}<button type="button" {{on "click" this.signOut}}>Sign out</button>{{/if}}{{/if}}{{#if this.value3}}<p>Signed in as {{this.value4}}</p>{{else}}<p>Nobody signed in</p>{{/if}}{{#if @owner}}<button
      type="button"
      {{on "click" this.listener1}}
    >{{this.value5}}</button>{{else}}<p>No owner</p>{{/if}}</section></template>
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
