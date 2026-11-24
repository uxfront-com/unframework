import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { VClickOutside } from "./v-click-outside";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-profile-menu",
  imports: [ScopeAttributes, Fallthrough, VClickOutside],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section
      class="profile-menu"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <div class="menu" [vClickOutside]="close">
        <button type="button" [attr.aria-expanded]="open" (click)="onAccount()">Account</button>
        @if (open) {
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        }
      </div>
      <p>Outside the menu</p>
    </section>
  `,
})
export default class ProfileMenu {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly closed = output<void>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly close = () => {
    if (!this.open()) return;
    this.open.set(false);
    this.closed.emit();
  };
  protected readonly open = signal(false);

  protected onAccount() {
    this.open.set(!this.open());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
