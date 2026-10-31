import { SetMetadata } from "@nestjs/common";

export const ALLOW_WITHOUT_ACK_KEY = "allow_without_regulation_ack";

/**
 * Эндпоинт доступен мастеру, даже если он не ознакомился с актуальным регламентом
 * (сам регламент, вход/выход, `me`). Всё остальное в ЛК блокируется до подтверждения.
 */
export const AllowWithoutRegulationAck = () => SetMetadata(ALLOW_WITHOUT_ACK_KEY, true);
