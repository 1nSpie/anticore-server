import { phoneSearchVariants } from "./phone-search";

describe("phoneSearchVariants", () => {
  it("оставляет только цифры", () => {
    expect(phoneSearchVariants("+7 (916) 123-45-67")).toEqual(["79161234567"]);
  });
  it("номер с 8 ищет и как 7…", () => {
    expect(phoneSearchVariants("8 916 123")).toEqual(["8916123", "7916123"]);
  });
  it("пустой или нецифровой запрос → без вариантов", () => {
    expect(phoneSearchVariants("")).toEqual([]);
    expect(phoneSearchVariants(undefined)).toEqual([]);
    expect(phoneSearchVariants("abc")).toEqual([]);
  });
});
