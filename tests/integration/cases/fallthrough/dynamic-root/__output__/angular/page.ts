import Base from "./base";
import Primary from "./primary";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  ViewEncapsulation,
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
  selector: "uf-page",
  imports: [Primary, Base, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let linked = this.linked();
    @let tone = this.tone();
    @let pressed = this.pressed();
    @let items = this.items();
    <section
      class="page"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-64cf7c28=""
      [ufScope]="this.host"
    >
      <uf-primary
        [href]="linked ? '#docs' : undefined"
        [disabled]="true"
        [text]="'Docs'"
        (press)="onPress()"
        [class]="'wide'"
        [style]="{ color: tone }"
        data-uf-64cf7c28=""
      />
      <uf-base
        [disabled]="true"
        [text]="'Off'"
        (press)="onPress_1()"
        [class]="['off', !linked ? 'muted' : null].join(' ')"
        data-uf-64cf7c28=""
      />
      <uf-base [text]="'Save'" (press)="onPress_2()" [class]="'save'" data-uf-64cf7c28="" />
      <ul aria-label="Items" data-uf-64cf7c28="">
        @for (item of items; track item.id) {
          <li data-uf-64cf7c28="">
            @switch (item.href ? "a" : "button") {
              @case ("a") {
                <a [attr.href]="item.href" class="item" data-uf-64cf7c28="">{{ item.label }}</a>
              } @case ("button") {
                <button
                  [attr.disabled]="item.disabled ? '' : null"
                  class="item"
                  data-uf-64cf7c28=""
                >{{ item.label }}</button>
              }
            }
          </li>
        }
      </ul>
      <button type="button" (click)="onToggle()" data-uf-64cf7c28="">Toggle</button>
      <output data-uf-64cf7c28="">{{ pressed }}</output>
    </section>
  `,
  styleUrl: "./Page.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly linked = signal(true);
  protected readonly tone = signal("rgb(29, 78, 216)");
  protected readonly pressed = signal("none");
  protected readonly items = signal([
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ]);

  protected onPress() {
    this.pressed.set("docs");
  }

  protected onPress_1() {
    this.pressed.set("off");
  }

  protected onPress_2() {
    this.pressed.set("save");
  }

  protected onToggle() {
    this.linked.set(!this.linked());
    this.tone.set(this.linked() ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
