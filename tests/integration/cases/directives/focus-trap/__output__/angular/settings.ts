import { VFocusTrap } from "./v-focus-trap";
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
  selector: "uf-settings",
  imports: [ScopeAttributes, VFocusTrap],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section
      class="settings"
      aria-label="Settings"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <button type="button" (click)="onOpen()">Open</button>
      @if (open) {
        <div
          role="dialog"
          aria-label="Preferences"
          tabindex="-1"
          class="dialog"
          [vFocusTrap]="open"
          (keydown)="onKeydown($event)"
        >
          <button type="button">Theme</button>
          <button type="button">Language</button>
          <button type="button" (click)="close()">Close</button>
        </div>
      }
    </section>
  `,
})
export default class Settings {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly open = signal(false);

  protected close() {
    this.open.set(false);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.close();
  }

  protected onOpen() {
    this.open.set(true);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
