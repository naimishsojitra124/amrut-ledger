import { describe, expect, it } from "vitest";

import { sortCustomersByCardOrder } from "./customer.service";

type Row = { id: string; fullName: string; status: "active" | "archived" };

function customer(id: string, fullName: string, status: Row["status"] = "active"): Row {
  return { id, fullName, status };
}

function order(rows: Row[], cards: Record<string, number>) {
  const map = new Map(Object.entries(cards));
  return sortCustomersByCardOrder(rows, map).map((row) => row.id);
}

describe("sortCustomersByCardOrder", () => {
  it("orders active customers by card number, not by how old the record is", () => {
    const rows = [customer("c", "Chirag"), customer("a", "Anil"), customer("b", "Bharat")];

    expect(order(rows, { a: 30, b: 2, c: 11 })).toEqual(["b", "c", "a"]);
  });

  it("compares card numbers numerically rather than as text", () => {
    const rows = [customer("a", "Anil"), customer("b", "Bharat"), customer("c", "Chirag")];

    expect(order(rows, { a: 100, b: 9, c: 11 })).toEqual(["b", "c", "a"]);
  });

  it("puts closed customers last however low their card number was", () => {
    const rows = [
      customer("closed", "Zarina", "archived"),
      customer("open", "Anil"),
    ];

    expect(order(rows, { closed: 1, open: 99 })).toEqual(["open", "closed"]);
  });

  it("keeps closed customers together at the end, never in the middle", () => {
    const rows = [
      customer("a", "Anil"),
      customer("x", "Xavier", "archived"),
      customer("b", "Bharat"),
      customer("y", "Yash", "archived"),
      customer("c", "Chirag"),
    ];

    expect(order(rows, { a: 3, b: 1, c: 2, x: 4, y: 5 })).toEqual(["b", "c", "a", "x", "y"]);
  });

  it("lists a customer holding no card after every carded customer in the same group", () => {
    const rows = [customer("none", "Anil"), customer("carded", "Zarina")];

    expect(order(rows, { carded: 500 })).toEqual(["carded", "none"]);
  });

  it("falls back to name, then id, so a page never repeats or drops a customer", () => {
    const rows = [customer("id2", "Bharat"), customer("id1", "Bharat"), customer("id0", "Anil")];

    expect(order(rows, {})).toEqual(["id0", "id1", "id2"]);
  });

  it("does not mutate the array it was given", () => {
    const rows = [customer("a", "Anil"), customer("b", "Bharat")];

    sortCustomersByCardOrder(rows, new Map([["b", 1]]));

    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
});
