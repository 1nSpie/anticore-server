import { StockMoveKind } from "../../../generated/prisma/client";

/** Знак и величина изменения остатка. Для ADJUST `qty` — новый фактический остаток, `current` — учётный. */
export function movementDelta(kind: StockMoveKind, qty: number, current: number): number {
  switch (kind) {
    case StockMoveKind.IN:
      return qty;
    case StockMoveKind.OUT:
      return -qty;
    case StockMoveKind.ADJUST:
      return Math.round((qty - current) * 1000) / 1000;
  }
}

/** Расход не может увести остаток в минус. */
export function wouldGoNegative(current: number, delta: number): boolean {
  return Math.round((current + delta) * 1000) < 0;
}

export const isLow = (qty: number, minQty: number) => minQty > 0 && qty < minQty;
