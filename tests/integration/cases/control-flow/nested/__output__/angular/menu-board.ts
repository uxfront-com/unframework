import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface MenuDish {
  id: string;
  name: string;
  price: number;
  vegetarian: boolean;
}

export interface MenuCourse {
  id: string;
  title: string;
  dishes: MenuDish[];
}

export interface MenuBoardProps {
  courses: MenuCourse[];
  closed: boolean;
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
  selector: "uf-menu-board",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let courses = this.courses();
    @let closed = this.closed();
    <div class="menu-board" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      @if (closed) {
        <p>The kitchen is closed.</p>
      } @else {
        @for (course of courses; track course.id) {
          <section [attr.aria-label]="course.title">
            <h2>{{ course.title }}</h2>
            <ul>
              @for (dish of course.dishes; track dish.id) {
                <li>{{ dish.name }}, {{ dish.price.toFixed(2) }}@if (dish.vegetarian) {<span> (vegetarian)</span>}</li>
              }
            </ul>
          </section>
        }
      }
    </div>
  `,
})
export default class MenuBoard {
  readonly courses = input.required<MenuCourse[]>();
  readonly closed = input.required<boolean>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
