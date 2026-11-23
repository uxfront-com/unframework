interface Config {
  environment: "development" | "production";
  locationType: "history" | "hash" | "none" | "auto";
  rootURL: string;
  APP: Record<string, unknown>;
}

const ENV: Config = {
  environment: import.meta.env.DEV ? "development" : "production",
  rootURL: "/",
  locationType: "history",
  APP: {},
};

export default ENV;
