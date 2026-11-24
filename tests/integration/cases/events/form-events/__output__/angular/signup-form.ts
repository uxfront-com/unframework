import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

@Component({
  selector: "uf-signup-form",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let fullName = this.fullName();
    @let email = this.email();
    @let plan = this.plan();
    @let newsletter = this.newsletter();
    @let focused = this.focused();
    <form
      class="signup-form"
      aria-label="Sign up"
      (submit)="submit($event)"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Name<input
        name="name"
        (change)="onNameChange($event)"
        (focus)="onNameFocus()"
        (blur)="onNameBlur()"
      /></label>
      <label>Email<input
        name="email"
        type="email"
        (input)="onEmailInput($event)"
        (focus)="onEmailFocus()"
        (blur)="onEmailBlur()"
      /></label>
      <label>Plan<select
        name="plan"
        (change)="onPlanChange($event)"
      ><option value="free">Free</option><option value="pro">Pro</option></select></label>
      <label><input name="newsletter" type="checkbox" (change)="onNewsletterChange($event)" />Send me the newsletter</label>
      <p
        role="status"
      >{{ "Name: " + fullName + "; email: " + email + "; plan: " + plan + "; newsletter: " + (newsletter ? "yes" : "no") + "; focus: " + focused }}</p>
      <button type="submit">Sign up</button>
    </form>
  `,
})
export default class SignupForm {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly signup = output<[fullName: string, email: string, plan: string, newsletter: boolean]>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly fullName = signal("");
  protected readonly email = signal("");
  protected readonly plan = signal("free");
  protected readonly newsletter = signal(false);
  protected readonly focused = signal("none");

  protected submit(event: SubmitEvent) {
    event.preventDefault();
    this.signup.emit([this.fullName(), this.email(), this.plan(), this.newsletter()]);
  }

  protected onNameChange(event: Event) {
    this.fullName.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onNameFocus() {
    this.focused.set("name");
  }

  protected onNameBlur() {
    this.focused.set("none");
  }

  protected onEmailInput(event: InputEvent) {
    this.email.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onEmailFocus() {
    this.focused.set("email");
  }

  protected onEmailBlur() {
    this.focused.set("none");
  }

  protected onPlanChange(event: Event) {
    this.plan.set((event.currentTarget as HTMLSelectElement).value);
  }

  protected onNewsletterChange(event: Event) {
    this.newsletter.set((event.currentTarget as HTMLInputElement).checked);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
