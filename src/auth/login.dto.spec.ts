import { validate } from "class-validator";
import { LoginDto } from "./login.dto";

const check = async (login: unknown, password: unknown) =>
  (await validate(Object.assign(new LoginDto(), { login, password }))).length === 0;

describe("LoginDto (единый вход)", () => {
  it("принимает логины мастеров: с точкой, цифры (телефон), до 64 символов", async () => {
    expect(await check("ivan.petrov", "secret-pass-1")).toBe(true);
    expect(await check("79852741779", "secret-pass-1")).toBe(true);
    expect(await check("a".repeat(64), "secret-pass-1")).toBe(true);
    expect(await check("Master_1-test", "x")).toBe(true); // длину пароля проверяем при создании учётки, не при входе
  });

  it("отклоняет пустые, слишком длинные и не строки", async () => {
    expect(await check("", "pass")).toBe(false);
    expect(await check("ivan", "")).toBe(false);
    expect(await check("a".repeat(65), "pass")).toBe(false);
    expect(await check("ivan", "p".repeat(129))).toBe(false);
    expect(await check(123, "pass")).toBe(false);
    expect(await check("ivan", undefined)).toBe(false);
  });
});
