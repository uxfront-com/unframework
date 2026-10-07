import { Component, input, output, signal } from "@angular/core";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

@Component({
  selector: "uf-account-menu",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let owner = this.owner();
    @let step = this.step();
    @let user = this.user();
    <section class="account-menu" aria-label="Account">
      @if (step === "intro") {
        <button type="button" (click)="start()">Start</button>
      } @else {
        @if (user === null) {
          <button type="button" (click)="signIn()">Sign in</button>
        } @else {
          <button type="button" (click)="signOut()">Sign out</button>
        }
      }
      @if (user !== null) {
        <p>Signed in as {{ user.name }}</p>
      } @else {
        <p>Nobody signed in</p>
      }
      @if (owner) {
        <button type="button" (click)="greet(owner.name)">{{ "Greet " + owner.name }}</button>
      } @else {
        <p>No owner</p>
      }
    </section>
  `,
})
export default class AccountMenu {
  readonly owner = input<User>();
  readonly greeted = output<string>();
  protected readonly step = signal("intro");
  protected readonly user = signal<User | null>(null);

  protected start() {
    this.step.set("account");
  }

  protected signIn() {
    this.user.set({ name: "Ada" });
  }

  protected signOut() {
    this.user.set(null);
  }

  protected greet(name: string) {
    this.greeted.emit(name);
  }
}
