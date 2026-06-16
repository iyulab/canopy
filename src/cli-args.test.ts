import { describe, expect, it } from "vitest";
import { parseBuildArgs } from "./cli-args.js";

describe("parseBuildArgs", () => {
  it("parses the build command with a vault and the default out dir", () => {
    expect(parseBuildArgs(["build", "myvault"])).toEqual({
      ok: true,
      vault: "myvault",
      out: "site",
      siteTitle: undefined,
      tokensCssPath: undefined,
    });
  });

  it("parses an explicit out directory", () => {
    expect(parseBuildArgs(["build", "v", "dist"])).toMatchObject({
      ok: true,
      vault: "v",
      out: "dist",
    });
  });

  it("parses --site-title and --tokens-css", () => {
    expect(
      parseBuildArgs([
        "build",
        "v",
        "out",
        "--site-title",
        "My Notes",
        "--tokens-css",
        "/t.css",
      ]),
    ).toMatchObject({
      ok: true,
      vault: "v",
      out: "out",
      siteTitle: "My Notes",
      tokensCssPath: "/t.css",
    });
  });

  it("accepts flags before the optional out positional", () => {
    expect(
      parseBuildArgs(["build", "v", "--site-title", "X"]),
    ).toMatchObject({ ok: true, vault: "v", out: "site", siteTitle: "X" });
  });

  it("rejects a missing vault", () => {
    expect(parseBuildArgs(["build"]).ok).toBe(false);
  });

  it("rejects an unknown command", () => {
    expect(parseBuildArgs(["serve", "v"]).ok).toBe(false);
  });

  it("rejects a flag missing its value", () => {
    const result = parseBuildArgs(["build", "v", "--site-title"]);
    expect(result.ok).toBe(false);
  });
});
