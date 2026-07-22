import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { isValidPhoneRu } from "../cabinet/common/phone.util";

@ValidatorConstraint({ name: "isPhoneRu", async: false })
export class IsPhoneRuConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return false;
    if (typeof value !== "string") return false;
    return isValidPhoneRu(value);
  }

  defaultMessage(): string {
    return "Укажите мобильный номер России в формате +7 9XX XXX XX XX";
  }
}

export function IsPhoneRu(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsPhoneRuConstraint,
    });
  };
}
