import { VClickOutside } from "./v-click-outside";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-profile-menu",
  imports: [ScopeAttributes, VClickOutside],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section
      class="profile-menu"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
  readonly closed = output<void>();
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
