import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";
import { StaffTokenService } from "./staff-token.service";

export const staffRoom = (staffId: number) => `staff:${staffId}`;

/** Разрешённые источники — те же, что в `main.ts` (в разработке — localhost:3000). */
function allowedOrigins(): string[] | string {
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return [
    "https://xn--80aaag6amsblus.xn--p1ai",
    process.env.FRONTEND_BASE_URL ?? "",
    process.env.SERVER_SELECTEL ?? "",
  ].filter(Boolean);
}

/**
 * Живые события для мастера (уведомления, обновление статусов). Подключение — по JWT сотрудника
 * в `handshake.auth.token`; каждый мастер слушает только свою комнату.
 * Путь `/api/socket.io` — чтобы работал существующий прокси nginx на `/api`.
 */
@WebSocketGateway({ namespace: "/staff", path: "/api/socket.io", cors: { origin: allowedOrigins(), credentials: true } })
export class StaffEventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(StaffEventsGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly tokens: StaffTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const payload = typeof token === "string" ? this.tokens.verify(token) : null;
      if (!payload) return client.disconnect(true);
      const staff = await this.prisma.staff.findUnique({ where: { id: Number(payload.sub) }, select: { id: true, blockedAt: true } });
      if (!staff || staff.blockedAt) return client.disconnect(true);
      await client.join(staffRoom(staff.id));
    } catch (e) {
      this.logger.warn(`Отказ в подключении: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  emitToStaff(staffId: number, event: string, payload: unknown) {
    this.server?.to(staffRoom(staffId)).emit(event, payload);
  }
}
