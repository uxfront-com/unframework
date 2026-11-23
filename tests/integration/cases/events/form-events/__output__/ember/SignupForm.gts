import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface SignupFormEvents {
  onSignup?: (fullName: string, email: string, plan: string, newsletter: boolean) => void;
}

export interface SignupFormSignature {
  Args: { style?: unknown } & SignupFormEvents;
  Element: HTMLElementTagNameMap["form"];
}

export default class SignupForm extends Component<SignupFormSignature> {
  submit = (event: SubmitEvent) => {
    event.preventDefault();
    this.args.onSignup?.(this.fullName, this.email, this.plan, this.newsletter);
  };

  @tracked fullName = "";

  @tracked email = "";

  @tracked plan = "free";

  @tracked newsletter = false;

  @tracked focused = "none";

  listener1 = (event: HTMLElementEventMap["change"]) =>
    (this.fullName = (event.currentTarget as HTMLInputElement).value);

  listener2 = () => (this.focused = "name");

  listener3 = () => (this.focused = "none");

  listener4 = (event: HTMLElementEventMap["input"]) =>
    (this.email = (event.currentTarget as HTMLInputElement).value);

  listener5 = () => (this.focused = "email");

  listener6 = (event: HTMLElementEventMap["change"]) =>
    (this.plan = (event.currentTarget as HTMLSelectElement).value);

  listener7 = (event: HTMLElementEventMap["change"]) =>
    (this.newsletter = (event.currentTarget as HTMLInputElement).checked);

  get value1() {
    return `Name: ${this.fullName}; email: ${this.email}; plan: ${this.plan}; newsletter: ${this.newsletter ? "yes" : "no"}; focus: ${this.focused}`;
  }

  <template><form
      class="signup-form"
      aria-label="Sign up"
      {{on "submit" this.submit}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Name<input
      name="name"
      {{on "change" this.listener1}}
      {{on "focus" this.listener2}}
      {{on "blur" this.listener3}}
    ></label><label>Email<input
      name="email"
      type="email"
      {{on "input" this.listener4}}
      {{on "focus" this.listener5}}
      {{on "blur" this.listener3}}
    ></label><label>Plan<select
      name="plan"
      {{on "change" this.listener6}}
    ><option value="free">Free</option><option value="pro">Pro</option></select></label><label><input
      name="newsletter"
      type="checkbox"
      {{on "change" this.listener7}}
    >Send me the newsletter</label><p role="status">{{this.value1}}</p><button
      type="submit"
    >Sign up</button></form></template>
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
