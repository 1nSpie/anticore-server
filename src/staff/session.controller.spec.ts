import { SessionController, extractToken } from "./session.controller";

const req = (headers: Record<string, string> = {}, cookies: Record<string, string> = {}) => ({ headers, cookies }) as any;

describe("extractToken", () => {
  it("заголовок Authorization главнее cookie", () => {
    expect(extractToken(req({ authorization: "Bearer from-header" }, { admin_token: "from-cookie" }))).toBe("from-header");
  });
  it("без заголовка берёт cookie админа, затем мастера", () => {
    expect(extractToken(req({}, { admin_token: "a", staff_token: "s" }))).toBe("a");
    expect(extractToken(req({}, { staff_token: "s" }))).toBe("s");
  });
  it("ничего нет или не Bearer — undefined", () => {
    expect(extractToken(req())).toBeUndefined();
    expect(extractToken(req({ authorization: "Basic abc" }))).toBeUndefined();
    expect(extractToken({ headers: {} } as any)).toBeUndefined(); // cookie-parser не подключён
  });
});

describe("SessionController.login — cookie под роль", () => {
  const run = async (kind: "admin" | "staff") => {
    const session: any = {
      login: jest.fn(async () => ({
        token: "tkn",
        user: { role: kind === "admin" ? "ADMIN" : "MASTER", kind, id: 1, login: "u", fullName: "U", locations: [] },
      })),
    };
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() };
    const body = await new SessionController(session).login({ login: "u", password: "p" }, {} as any, res);
    return { res, body };
  };

  it("админ: cookie admin_token на 12 часов, cookie мастера сбрасывается; в ответе роль и kind", async () => {
    const { res, body } = await run("admin");
    expect(res.cookie).toHaveBeenCalledWith("admin_token", "tkn", expect.objectContaining({ httpOnly: true, maxAge: 12 * 3600 * 1000 }));
    expect(res.clearCookie).toHaveBeenCalledWith("staff_token", expect.anything());
    expect(body).toMatchObject({ success: true, token: "tkn", role: "ADMIN", kind: "admin" });
  });

  it("мастер: cookie staff_token на 30 дней, cookie админа сбрасывается", async () => {
    const { res, body } = await run("staff");
    expect(res.cookie).toHaveBeenCalledWith("staff_token", "tkn", expect.objectContaining({ httpOnly: true, maxAge: 30 * 86400 * 1000 }));
    expect(res.clearCookie).toHaveBeenCalledWith("admin_token", expect.anything());
    expect(body).toMatchObject({ role: "MASTER", kind: "staff" });
  });
});
