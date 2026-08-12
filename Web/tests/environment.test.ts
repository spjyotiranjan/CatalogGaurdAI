import { afterEach, describe, expect, it } from "vitest";

import {
  getEnvironment,
  resetEnvironmentForTests,
} from "@/server/config/env";

const originalEnvironment = {
  CATALOGGUARD_ENVIRONMENT: process.env.CATALOGGUARD_ENVIRONMENT,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
  API_DOCS_ENABLED: process.env.API_DOCS_ENABLED,
};

afterEach(() => {
  process.env.CATALOGGUARD_ENVIRONMENT = originalEnvironment.CATALOGGUARD_ENVIRONMENT;
  process.env.AUTH_SECRET = originalEnvironment.AUTH_SECRET;
  process.env.AUTH_URL = originalEnvironment.AUTH_URL;
  process.env.AUTH_TRUST_HOST = originalEnvironment.AUTH_TRUST_HOST;
  process.env.API_DOCS_ENABLED = originalEnvironment.API_DOCS_ENABLED;
  resetEnvironmentForTests();
});

describe("environment validation", () => {
  it("accepts the complete test configuration", () => {
    expect(getEnvironment()).toMatchObject({
      CATALOGGUARD_ENVIRONMENT: "test",
      AUTH_URL: "http://localhost:3000",
      AUTH_TRUST_HOST: true,
      API_DOCS_ENABLED: true,
    });
  });

  it("fails fast when an authentication secret is absent", () => {
    resetEnvironmentForTests();
    delete process.env.AUTH_SECRET;
    expect(() => getEnvironment()).toThrow();
  });

  it("requires HTTPS for the canonical production URL", () => {
    resetEnvironmentForTests();
    process.env.CATALOGGUARD_ENVIRONMENT = "production";
    process.env.AUTH_URL = "http://catalog.example";
    expect(() => getEnvironment()).toThrow();
  });

  it("rejects disabled Auth.js trusted-host handling", () => {
    resetEnvironmentForTests();
    process.env.AUTH_TRUST_HOST = "false";
    expect(() => getEnvironment()).toThrow();
  });

  it("disables API documentation by default in production", () => {
    resetEnvironmentForTests();
    process.env.CATALOGGUARD_ENVIRONMENT = "production";
    process.env.AUTH_URL = "https://catalog.example";
    delete process.env.API_DOCS_ENABLED;

    expect(getEnvironment().API_DOCS_ENABLED).toBe(false);
  });
});
