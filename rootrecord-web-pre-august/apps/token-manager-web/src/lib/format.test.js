import {
  parseDecimalToBaseUnits,
  formatBaseUnits,
} from "./format";

describe("parseDecimalToBaseUnits", () => {
  it("returns null for invalid input", () => {
    expect(parseDecimalToBaseUnits(null, 9)).toBeNull();
    expect(parseDecimalToBaseUnits(undefined, 9)).toBeNull();
    expect(parseDecimalToBaseUnits("", 9)).toBeNull();
    expect(parseDecimalToBaseUnits("  ", 9)).toBeNull();
    expect(parseDecimalToBaseUnits("1.2.3", 9)).toBeNull();
    expect(parseDecimalToBaseUnits("abc", 9)).toBeNull();
    expect(parseDecimalToBaseUnits("-1", 9)).toBeNull();
  });

  it("rejects too many fractional digits for token decimals", () => {
    expect(parseDecimalToBaseUnits("1.234", 2)).toBeNull();
    expect(parseDecimalToBaseUnits("0.001", 2)).toBeNull();
  });

  it("parses integer strings", () => {
    expect(parseDecimalToBaseUnits("0", 9)).toBe(0n);
    expect(parseDecimalToBaseUnits("1", 0)).toBe(1n);
    expect(parseDecimalToBaseUnits("10", 9)).toBe(10_000_000_000n);
  });

  it("parses decimals without floating-point loss", () => {
    expect(parseDecimalToBaseUnits("1.5", 1)).toBe(15n);
    expect(parseDecimalToBaseUnits("0.000001", 6)).toBe(1n);
    expect(parseDecimalToBaseUnits("1.234567", 6)).toBe(1_234_567n);
    expect(parseDecimalToBaseUnits(".5", 1)).toBe(5n);
    expect(parseDecimalToBaseUnits("0.", 4)).toBe(0n);
  });

  it("trims whitespace", () => {
    expect(parseDecimalToBaseUnits("  2.5  ", 1)).toBe(25n);
  });

  it("handles leading zeros in whole part", () => {
    expect(parseDecimalToBaseUnits("00010.5", 1)).toBe(105n);
  });
});

describe("formatBaseUnits", () => {
  it("formats whole and fractional parts", () => {
    expect(formatBaseUnits(123456789n, 9)).toBe("0.123456789");
    expect(formatBaseUnits(1_000_000_000n, 9)).toBe("1");
    expect(formatBaseUnits(1500n, 3)).toBe("1.5");
  });
});
