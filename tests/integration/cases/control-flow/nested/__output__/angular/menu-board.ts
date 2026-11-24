import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

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

@Component({
  selector: "uf-menu-board",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let courses = this.courses();
    @let closed = this.closed();
    <div
      class="menu-board"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
