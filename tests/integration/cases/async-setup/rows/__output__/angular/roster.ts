import Member from "./member";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
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
  selector: "uf-roster",
  imports: [Member, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let ids = this.ids();
    @let lead = this.lead();
    @let guest = this.guest();
    <section
      class="roster"
      aria-label="Roster"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <button type="button" (click)="onSwitchLead()">Switch lead</button>
      <button type="button" (click)="onToggleGuest()">Toggle guest</button>
      <ul>
        @for (id of ids; track id) {
          <uf-member [id]="id" />
        }
        @if (lead) {
          <uf-member [id]="'ada'" />
        } @else {
          <uf-member [id]="'linus'" />
        }
        @if (guest) {
          <uf-member [id]="'hopper'" />
        }
      </ul>
    </section>
  `,
})
export default class Roster {
  readonly ids = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly lead = signal(true);
  protected readonly guest = signal(false);

  protected onSwitchLead() {
    this.lead.set(!this.lead());
  }

  protected onToggleGuest() {
    this.guest.set(!this.guest());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
