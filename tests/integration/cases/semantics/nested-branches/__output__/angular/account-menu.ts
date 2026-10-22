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

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

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
  selector: "uf-account-menu",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let owner = this.owner();
    @let step = this.step();
    @let user = this.user();
    <section
      class="account-menu"
      aria-label="Account"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
