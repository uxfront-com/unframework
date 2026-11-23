// `ember-source` publishes its modules' types as ambient declarations.
/// <reference types="ember-source/types" />
import { get } from "@ember/helper";
import Route from "@ember/routing/route";
import EmberRouter from "@ember/routing/router";
import { template } from "@ember/template-compiler/runtime";
import EmberApp from "ember-strict-application-resolver";

/** The router of the app that renders one component: its one route is the application's. */
class Router extends EmberRouter {
  override location = "none";
  override rootURL = "/";
}

/**
 * The app that renders one component, on the server and in the browser alike, so a hydrating
 * client builds the tree the server serialised. Its application template invokes the component
 * with an argument for each name, read from the route's model, `args`: Glimmer spreads no
 * arguments, so the template names each one.
 */
export function appFor(
  component: unknown,
  names: readonly string[],
  args: Record<string, unknown>,
): typeof EmberApp {
  const invocation = names
    .map((name) => `@${name}={{get @model ${JSON.stringify(name)}}}`)
    .join(" ");
  const application = template(`<Component ${invocation} />`, {
    scope: () => ({ Component: component, get }),
  });
  class ApplicationRoute extends Route {
    override model(): Record<string, unknown> {
      return args;
    }
  }
  return class App extends EmberApp {
    modulePrefix = "uf-app";
    override modules = {
      "./router": Router,
      "./routes/application": ApplicationRoute,
      "./templates/application": application,
    };
  };
}
