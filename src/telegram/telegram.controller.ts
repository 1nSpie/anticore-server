import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from "@nestjs/common";
import { TelegramService } from "./telegram.service";

interface SimpleTelegramMessage {
  name: string;
  phone: string;
  message: string;
  href?: string;
}

export type ContactMethod = "telegram" | "whatsapp" | "phone";

export type AutoPriceFormData = {
  brand: string;
  model: string;
  customBrand: string;
  isNotAuto: boolean;
  name: string;
  phone: string;
  contactMethod: ContactMethod;
};

// Validation utilities
const validateInput = (data: any, requiredFields: string[]) => {
  for (const field of requiredFields) {
    if (
      !data[field] ||
      typeof data[field] !== "string" ||
      data[field].trim().length === 0
    ) {
      throw new BadRequestException(
        `Field '${field}' is required and must be a non-empty string`
      );
    }
  }
};

const validateName = (name: string) => {
  if (name.trim().length < 2 || name.trim().length > 100) {
    throw new BadRequestException("Name must be between 2 and 100 characters");
  }
};

const validatePhone = (phone: string) => {
  const phoneRegex = /^[+]?[0-9\s\-\(\)]{10,20}$/;
  if (!phoneRegex.test(phone.trim())) {
    throw new BadRequestException("Invalid phone number format");
  }
};

const validateMessage = (message: string) => {
  if (message && message.length > 1000) {
    throw new BadRequestException("Message must not exceed 1000 characters");
  }
};

const sanitizeInput = (input: string): string => {
  return input.replace(/[<>"'&]/g, "").trim();
};

@Controller("telegram")
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post("send-message")
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() data: SimpleTelegramMessage) {
    try {
      // Server-side validation
      validateInput(data, ["name", "phone"]);
      validateName(data.name);
      validatePhone(data.phone);
      if (data.message) {
        validateMessage(data.message);
      }

      // Sanitize data
      const sanitizedData = {
        name: sanitizeInput(data.name),
        phone: sanitizeInput(data.phone),
        message: data.message ? sanitizeInput(data.message) : "",
        href: data.href || "",
      };

      await this.telegramService.sendMessage(sanitizedData);
      return { success: true, message: "Message sent successfully" };
    } catch (error) {
      throw new BadRequestException("Failed to send message: " + error.message);
    }
  }

  @Post("send-full")
  @HttpCode(HttpStatus.OK)
  async sendFeedback(@Body() data: AutoPriceFormData) {
    try {
      // Server-side validation
      validateInput(data, ["name", "phone", "contactMethod"]);
      validateName(data.name);
      validatePhone(data.phone);

      if (!["telegram", "whatsapp", "phone"].includes(data.contactMethod)) {
        throw new BadRequestException("Invalid contact method");
      }

      if (!data.isNotAuto && (!data.brand || !data.model)) {
        throw new BadRequestException(
          "Brand and model are required when isNotAuto is false"
        );
      }

      if (data.isNotAuto && !data.customBrand) {
        throw new BadRequestException(
          "Custom brand is required when isNotAuto is true"
        );
      }

      // Sanitize data
      const sanitizedData = {
        name: sanitizeInput(data.name),
        phone: sanitizeInput(data.phone),
        carDescription: data.isNotAuto
          ? sanitizeInput(data.customBrand)
          : `${sanitizeInput(data.brand)} ${sanitizeInput(data.model)}`,
        communicationMethod: data.contactMethod,
      };

      await this.telegramService.sendMessage(sanitizedData);
      return {
        success: true,
        message: "Feedback sent to Telegram successfully",
      };
    } catch (error) {
      throw new BadRequestException(
        "Failed to send feedback: " + error.message
      );
    }
  }
}
