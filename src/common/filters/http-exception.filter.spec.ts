import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AllExceptionsFilter } from "./http-exception.filter";

function run(exception: unknown) {
  const json = jest.fn();
  const res: any = { status: jest.fn(() => ({ json, send: jest.fn() })) };
  const req: any = { url: "/api/staff/tasks", method: "GET", get: () => "Mozilla/5.0" };
  const host: any = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) };
  new AllExceptionsFilter().catch(exception, host);
  return json.mock.calls[0][0];
}

describe("AllExceptionsFilter", () => {
  it("передаёт клиенту строковый code из тела исключения", () => {
    const body = run(new ForbiddenException({ statusCode: 403, code: "REGULATION_ACK_REQUIRED", message: "Нужно ознакомиться" }));
    expect(body).toMatchObject({ statusCode: 403, code: "REGULATION_ACK_REQUIRED", message: "Нужно ознакомиться" });
  });

  it("обычные ошибки без code остаются прежней формы", () => {
    const body = run(new NotFoundException("Не найдено"));
    expect(body.code).toBeUndefined();
    expect(Object.keys(body).sort()).toEqual(["error", "message", "method", "path", "statusCode", "timestamp"]);
  });
});
