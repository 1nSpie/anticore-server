import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { isValidVin } from "./vin.util";

@ValidatorConstraint({ name: "isVin", async: false })
export class IsVinConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return true;
    if (typeof value !== "string") return false;
    return isValidVin(value);
  }

  defaultMessage(): string {
    return "Некорректный VIN (17 символов, стандарт ISO 3779, без I/O/Q)";
  }
}

export function IsVin(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsVinConstraint,
    });
  };
}
