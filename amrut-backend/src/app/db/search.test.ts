import { describe, expect, it } from "vitest";

import { escapeRegex, MAX_SEARCH_LENGTH, searchTerm } from "./search";

// Prisma's Mongo `contains` is a $regex, so an unescaped term is a pattern the database runs.
describe("escapeRegex", () => {
  it("neutralises every regex metacharacter", () => {
    const pattern = new RegExp(escapeRegex(".*+?^${}()|[]\\"));

    expect(pattern.test(".*+?^${}()|[]\\")).toBe(true);
    expect(pattern.test("anything else")).toBe(false);
  });

  it("makes an anchor match literally", () => {
    expect(new RegExp(escapeRegex("^Bharat")).test("Bharatbhai")).toBe(false);
    expect(new RegExp(escapeRegex("^Bharat")).test("^Bharat")).toBe(true);
  });

  it("stops a wildcard matching across characters", () => {
    expect(new RegExp(escapeRegex("Bhar.tbhai")).test("Bharatbhai")).toBe(false);
  });

  it("defuses a catastrophic backtracking pattern", () => {
    const escaped = escapeRegex("(a+)+$");
    const started = Date.now();

    expect(new RegExp(escaped).test("a".repeat(40) + "b")).toBe(false);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeRegex("Bharatbhai Ahir")).toBe("Bharatbhai Ahir");
    expect(escapeRegex("BILL-09-2026-19")).toBe("BILL-09-2026-19");
  });
});

describe("searchTerm", () => {
  it("returns undefined for nothing to search on", () => {
    expect(searchTerm(undefined)).toBeUndefined();
    expect(searchTerm(null)).toBeUndefined();
    expect(searchTerm("")).toBeUndefined();
    expect(searchTerm("   ")).toBeUndefined();
  });

  it("trims before deciding a term is empty", () => {
    expect(searchTerm("  Ahir  ")).toBe("Ahir");
  });

  it("caps the length", () => {
    const term = searchTerm("a".repeat(500));

    expect(term).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("caps before escaping, so the result cannot exceed twice the cap", () => {
    const term = searchTerm("(".repeat(500));

    expect(term).toBe("\\(".repeat(MAX_SEARCH_LENGTH));
  });

  it("escapes what it returns", () => {
    expect(searchTerm("B.*Ahir")).toBe("B\\.\\*Ahir");
  });

  it("keeps a numeric term usable as a number", () => {
    expect(Number(searchTerm("19"))).toBe(19);
  });
});
