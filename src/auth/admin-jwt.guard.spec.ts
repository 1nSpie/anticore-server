import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';

function ctxWith(headers: Record<string, string>, cookies: Record<string, string> = {}) {
  const req: any = { headers, cookies };
  return {
    req,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext,
  };
}

describe('AdminJwtGuard (SEC-1)', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
  });

  function setup(env: Record<string, string | undefined>) {
    process.env = { ...OLD_ENV, ...env };
    const service = new AdminAuthService();
    const guard = new AdminJwtGuard(service);
    return { service, guard };
  }

  it('пропускает токен, выданный /admin/login', () => {
    const { service, guard } = setup({ JWT_SECRET: 'shared', ADMIN_JWT_SECRET: undefined });
    const { ctx, req } = ctxWith({ authorization: `Bearer ${service.createToken()}` });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.admin).toEqual({ id: 'admin', role: 'admin' });
  });

  it('отклоняет access-токен личного кабинета, подписанный тем же JWT_SECRET', () => {
    const { guard } = setup({ JWT_SECRET: 'shared', ADMIN_JWT_SECRET: undefined });
    // Ровно так подписывает CabinetAuthService.signAccessToken
    const cabinetToken = jwt.sign({ sub: '42', typ: 'cabinet_access' }, 'shared', { expiresIn: 900 });
    const { ctx } = ctxWith({ authorization: `Bearer ${cabinetToken}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('отклоняет старый админ-токен без audience/typ (нужен повторный вход)', () => {
    const { guard } = setup({ JWT_SECRET: 'shared', ADMIN_JWT_SECRET: undefined });
    const legacy = jwt.sign({ sub: 'admin', role: 'admin' }, 'shared', { expiresIn: '12h' });
    const { ctx } = ctxWith({ authorization: `Bearer ${legacy}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('отклоняет поддельный токен с role=admin, но без правильного audience', () => {
    const { guard } = setup({ JWT_SECRET: 'shared', ADMIN_JWT_SECRET: undefined });
    const forged = jwt.sign({ sub: 'x', role: 'admin', typ: 'admin_access' }, 'shared');
    const { ctx } = ctxWith({ authorization: `Bearer ${forged}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('с ADMIN_JWT_SECRET токен, подписанный JWT_SECRET, не проходит даже с верными полями', () => {
    const { guard } = setup({ JWT_SECRET: 'shared', ADMIN_JWT_SECRET: 'admin-only' });
    const t = jwt.sign({ sub: 'admin', role: 'admin', typ: 'admin_access' }, 'shared', {
      audience: 'anticore-admin',
      issuer: 'anticore-server',
    });
    const { ctx } = ctxWith({ authorization: `Bearer ${t}` });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('проверяет логин/пароль и не пускает при незаданных env', () => {
    const a = setup({ JWT_SECRET: 's', ADMIN_LOGIN: 'boss', ADMIN_PASSWORD: 'pass1' }).service;
    expect(a.validateCredentials('boss', 'pass1')).toBe(true);
    expect(a.validateCredentials('boss', 'pass2')).toBe(false);
    expect(a.validateCredentials('bos', 'pass1')).toBe(false);
    const b = setup({ JWT_SECRET: 's', ADMIN_LOGIN: undefined, ADMIN_PASSWORD: undefined }).service;
    expect(b.validateCredentials('undefined', 'undefined')).toBe(false);
  });
});
