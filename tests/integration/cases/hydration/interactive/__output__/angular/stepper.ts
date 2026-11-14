import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from "@angular/core";

export interface StepperProps {
  start?: number;
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
  selector: "uf-stepper",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <div class="stepper" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <output>{{ count }}</output>
      <button type="button" (click)="add()">Add one</button>
    </div>
  `,
})
export default class Stepper implements OnInit {
  readonly start = input<number, number | undefined>(0, {
    transform: (value) => (value === undefined ? 0 : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufChange = output<number>();
  protected readonly count = linkedSignal(() => untracked(() => this.start()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }

  protected add() {
    this.count.update((count) => count + 1);
    this.ufChange.emit(this.count());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
