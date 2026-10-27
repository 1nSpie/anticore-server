import { StaffEventsGateway, staffRoom } from "./staff-events.gateway";
import { StaffTokenService } from "./staff-token.service";

function client(auth: unknown) {
  return { handshake: { auth }, join: jest.fn(async () => undefined), disconnect: jest.fn() } as any;
}

describe("StaffEventsGateway", () => {
  let tokens: StaffTokenService;
  let staffRow: any;
  let gw: StaffEventsGateway;

  beforeEach(() => {
    process.env.STAFF_JWT_SECRET = "ws-test-secret";
    tokens = new StaffTokenService();
    staffRow = { id: 7, blockedAt: null };
    const prisma: any = { staff: { findUnique: jest.fn(async () => staffRow) } };
    gw = new StaffEventsGateway(tokens, prisma);
  });

  it("с валидным токеном мастер попадает в свою комнату", async () => {
    const c = client({ token: tokens.sign(7, "MASTER") });
    await gw.handleConnection(c);
    expect(c.join).toHaveBeenCalledWith(staffRoom(7));
    expect(c.disconnect).not.toHaveBeenCalled();
  });

  it("без токена, с мусором и с чужим типом токена — отключение", async () => {
    for (const auth of [{}, { token: "garbage" }, { token: 123 }, undefined]) {
      const c = client(auth);
      await gw.handleConnection(c);
      expect(c.disconnect).toHaveBeenCalledWith(true);
      expect(c.join).not.toHaveBeenCalled();
    }
  });

  it("заблокированный или удалённый сотрудник не подключается", async () => {
    for (const row of [{ id: 7, blockedAt: new Date() }, null]) {
      staffRow = row;
      const c = client({ token: tokens.sign(7, "MASTER") });
      await gw.handleConnection(c);
      expect(c.disconnect).toHaveBeenCalledWith(true);
    }
  });

  it("событие уходит только в комнату адресата", () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    (gw as any).server = { to };
    gw.emitToStaff(7, "notification", { id: 1 });
    expect(to).toHaveBeenCalledWith("staff:7");
    expect(emit).toHaveBeenCalledWith("notification", { id: 1 });
  });

  it("emit до инициализации сервера не падает", () => {
    expect(() => gw.emitToStaff(7, "notification", {})).not.toThrow();
  });
});
