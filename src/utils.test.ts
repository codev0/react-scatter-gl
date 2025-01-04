import { describe, it, expect } from "vitest";
import { decodeIdFromRgb } from "./utils";

describe("utils", () => {
  it("it should decode an rgb color to a numeric id", () => {
    const r = 0x12;
    const g = 0x34;
    const b = 0x56;
    const id = decodeIdFromRgb(r, g, b);
    expect(id).toBe(0x123456);
  });

  it("it should decode an rgb color to a numeric id", () => {
    const r = 0x00;
    const g = 0x00;
    const b = 0x00;
    const id = decodeIdFromRgb(r, g, b);
    expect(id).toBe(0x000000);
  });

  it("it should decode an rgb color to a numeric id", () => {
    const r = 0xff;
    const g = 0xff;
    const b = 0xff;
    const id = decodeIdFromRgb(r, g, b);
    expect(id).toBe(0xffffff);
  });

  it("it should decode an rgb color to a numeric id", () => {
    // 41 41 161
    const r = 0x41;
    const g = 0x41;
    const b = 0xa1;
    const id = decodeIdFromRgb(r, g, b);
    expect(id).toBe(0x4141a1);
  });
});
