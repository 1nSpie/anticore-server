import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { StaffRole } from "../../generated/prisma/client";
import { ADMIN_ENV_SUBJECT, AdminAuthService, staffIdFromSubject } from "../auth/admin-auth.service";
import { PrismaService } from "../prisma/prisma.service";

export const ADMINS_ROOM = "admins";

function allowedOrigins(): string[] | string {
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return [
    "https://xn--80aaag6amsblus.xn--p1ai",
    process.env.FRONTEND_BASE_URL ?? "",
    process.env.SERVER_SELECTEL ?? "",
  ].filter(Boolean);
}

/**
 * Живые события для администраторов (новые заявки). Подключение — по JWT админки в `handshake.auth.token`;
 * сотрудник с ролью ADMIN дополнительно проверяется по БД, как в `AdminJwtGuard`.
 */
@WebSocketGateway({ namespace: "/admin", path: "/api/socket.io", cors: { origin: allowedOrigins(), credentials: true } })
export class AdminEventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(AdminEventsGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly auth: AdminAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const verified = typeof token === "string" ? this.auth.verifyToken(token) : null;
      if (!verified?.isValid || !verified.payload) return client.disconnect(true);

      const sub = verified.payload.sub;
      if (sub !== ADMIN_ENV_SUBJECT) {
        const staffId = staffIdFromSubject(sub);
        const staff = staffId === null ? null : await this.prisma.staff.findUnique({ where: { id: staffId }, select: { role: true, blockedAt: true } });
        if (!staff || staff.blockedAt || staff.role !== StaffRole.ADMIN) return client.disconnect(true);
      }
      await client.join(ADMINS_ROOM);
    } catch (e) {
      this.logger.warn(`Отказ в подключении: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  emitToAdmins(event: string, payload: unknown) {
    this.server?.to(ADMINS_ROOM).emit(event, payload);
  }
}
