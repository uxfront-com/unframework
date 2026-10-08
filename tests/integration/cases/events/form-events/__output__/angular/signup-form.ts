import { Component, output, signal } from "@angular/core";

@Component({
  selector: "uf-signup-form",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let fullName = this.fullName();
    @let email = this.email();
    @let plan = this.plan();
    @let newsletter = this.newsletter();
    @let focused = this.focused();
    <form class="signup-form" aria-label="Sign up" (submit)="submit($event)">
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
  readonly signup = output<[fullName: string, email: string, plan: string, newsletter: boolean]>();
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
}
