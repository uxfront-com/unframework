import { Component, signal } from "@angular/core";
import {
  Button,
  Card,
  CardFooter,
  CardHeader,
  Counter,
  TextField,
  useToggle,
} from "@unframework.dev/e2e-design-system/angular";

@Component({
  selector: "app-showcase",
  imports: [Button, Card, CardHeader, CardFooter, Counter, TextField],
  template: `
    <main>
      <uf-button (press)="presses.set(presses() + 1)">Press me</uf-button>
      <p>Presses: {{ presses() }}</p>
      <uf-counter [initial]="2" [step]="3" />
      <uf-text-field label="Name" [(value)]="name" />
      <p>Name: {{ name() }}</p>
      <uf-card>
        <ng-template ufCardHeader><h2>Card header</h2></ng-template>
        <button type="button" (click)="toggle.toggle()">Toggle card</button>
        <ng-template ufCardFooter>
          <p>{{ toggle.on() ? "Open" : "Closed" }}</p>
        </ng-template>
      </uf-card>
    </main>
  `,
})
export class Showcase {
  protected readonly presses = signal(0);
  protected readonly name = signal("");
  protected readonly toggle = useToggle(false);
}
