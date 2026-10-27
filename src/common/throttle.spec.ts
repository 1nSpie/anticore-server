import { THROTTLER_LIMIT, THROTTLER_TTL } from "@nestjs/throttler/dist/throttler.constants";
import { ADMIN_RATE, STAFF_LOGIN_RATE, STAFF_RATE } from "./throttle";
import { CabinetAdminController } from "../cabinet/admin/cabinet-admin.controller";
import { CabinetAuthController } from "../cabinet/auth/cabinet-auth.controller";
import { CarsController } from "../cars/cars.controller";
import { CrmAppointmentsController } from "../crm/appointments/crm-appointments.controller";
import { CrmClientVehiclesController } from "../crm/clients/crm-client-vehicles.controller";
import { CrmClientsController } from "../crm/clients/crm-clients.controller";
import { CrmLeadsController } from "../crm/leads/crm-leads.controller";
import { CrmSettingsController } from "../crm/settings/crm-settings.controller";
import { MediaController } from "../media/media.controller";
import { CrmCheckinsController, StaffCheckinController } from "../staff/checkin.controller";
import { StaffNotificationsController } from "../staff/notifications.controller";
import { CrmRegulationController, StaffRegulationController } from "../staff/regulation.controller";
import { StaffAdminController } from "../staff/staff-admin.controller";
import { StaffAuthController } from "../staff/staff-auth.controller";
import { AppointmentAssigneesController, StaffScheduleController } from "../staff/staff-schedule.controller";
import { CrmTasksController, StaffTasksController } from "../staff/tasks.controller";
import { BrandsController } from "../brands/brands.controller";

const limitOf = (target: object) => Reflect.getMetadata(THROTTLER_LIMIT + "default", target);
const ttlOf = (target: object) => Reflect.getMetadata(THROTTLER_TTL + "default", target);

describe("лимиты запросов", () => {
  it("админка (CRM, клиенты ЛК, медиа, сотрудники) — повышенный лимит", () => {
    for (const c of [
      CrmAppointmentsController, CrmSettingsController, CrmClientsController, CrmClientVehiclesController, CrmLeadsController,
      CabinetAdminController, MediaController, StaffAdminController, CrmRegulationController, CrmTasksController,
      CrmCheckinsController, AppointmentAssigneesController,
    ]) {
      expect({ name: c.name, limit: limitOf(c), ttl: ttlOf(c) }).toEqual({ name: c.name, limit: ADMIN_RATE.limit, ttl: ADMIN_RATE.ttl });
    }
  });

  it("кабинет мастера — ещё выше (весь цех сидит с одного IP)", () => {
    for (const c of [
      StaffScheduleController, StaffCheckinController, StaffTasksController, StaffRegulationController, StaffNotificationsController,
      StaffAuthController,
    ]) {
      expect({ name: c.name, limit: limitOf(c) }).toEqual({ name: c.name, limit: STAFF_RATE.limit });
    }
    expect(STAFF_RATE.limit).toBeGreaterThan(ADMIN_RATE.limit);
  });

  it("вход мастера: свой лимит на метод перекрывает лимит класса, и он выше прежних 5", () => {
    const login = StaffAuthController.prototype.login;
    expect(limitOf(login)).toBe(STAFF_LOGIN_RATE.limit);
    expect(ttlOf(login)).toBe(STAFF_LOGIN_RATE.ttl);
    expect(STAFF_LOGIN_RATE.limit).toBeGreaterThan(5);
  });

  it("публичные эндпоинты остаются на общем лимите — защита форм сайта от спама не ослаблена", () => {
    // (VkController не импортируем: vk-io использует динамический import и роняет Jest)
    for (const c of [CarsController, BrandsController, CabinetAuthController]) {
      expect({ name: c.name, limit: limitOf(c) }).toEqual({ name: c.name, limit: undefined });
    }
    // а вход в админку не освобождён и не повышен
    const { AdminAuthController } = jest.requireActual("../auth/admin-auth.controller");
    expect(limitOf(AdminAuthController)).toBeUndefined();
  });
});
