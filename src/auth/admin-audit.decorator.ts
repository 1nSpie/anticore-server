// src/common/decorators/admin-audit.decorator.ts
import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

export const AUDIT_ACTION_KEY = 'audit_action';

export interface AuditOptions {
  action: string;
  resource?: string;
  description?: string;
}

export function AdminAudit(options: AuditOptions): MethodDecorator {
  return applyDecorators(
    SetMetadata(AUDIT_ACTION_KEY, options),
    ApiBearerAuth('admin-token'),
  );
}