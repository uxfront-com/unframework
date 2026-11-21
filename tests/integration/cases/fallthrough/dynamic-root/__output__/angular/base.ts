import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
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
  selector: "uf-base",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let disabled = this.disabled();
    @let text = this.text();
    @switch (href ? "a" : "button") {
      @case ("a") {
        <a
          [attr.href]="href"
          class="base"
          [style]="{ padding: '4px 8px', ...this.style() }"
          (click)="onPress($event)"
          [class]="this.class()"
          [ufScope]="this.host"
        >{{ text }}</a>
      } @case ("button") {
        <button
          [attr.disabled]="disabled ? '' : null"
          class="base"
          [style]="{ padding: '4px 8px', ...this.style() }"
          (click)="onPress($event)"
          [class]="this.class()"
          [ufScope]="this.host"
        >{{ text }}</button>
      }
    }
  `,
})
export default class Base {
  readonly href = input<string>();
  readonly disabled = input<boolean>();
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly press = output<void>();

  protected onPress(event: MouseEvent) {
    event.preventDefault();
    this.press.emit();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
