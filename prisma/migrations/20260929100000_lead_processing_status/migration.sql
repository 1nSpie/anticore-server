-- AlterEnum (отдельная миграция: новое значение enum нельзя использовать в той же транзакции)
ALTER TYPE "SiteLeadStatus" ADD VALUE 'PROCESSING';
