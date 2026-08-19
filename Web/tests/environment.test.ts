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
  MONGODB_DNS_SERVERS: process.env.MONGODB_DNS_SERVERS,
};

function restoreEnvironmentVariable(
  name: keyof typeof originalEnvironment,
): void {
  const value = originalEnvironment[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  for (const name of Object.keys(originalEnvironment) as Array<
    keyof typeof originalEnvironment
  >) {
    restoreEnvironmentVariable(name);
  }
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

  it("parses an explicit MongoDB DNS resolver list", () => {
    resetEnvironmentForTests();
    process.env.MONGODB_DNS_SERVERS = "1.1.1.1, 8.8.8.8";

    expect(getEnvironment().MONGODB_DNS_SERVERS).toEqual(["1.1.1.1", "8.8.8.8"]);
  });

  it("rejects invalid MongoDB DNS resolver addresses", () => {
    resetEnvironmentForTests();
    process.env.MONGODB_DNS_SERVERS = "not-a-dns-server";

    expect(() => getEnvironment()).toThrow();
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
