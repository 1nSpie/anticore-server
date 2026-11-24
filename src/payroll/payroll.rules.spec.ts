import { closingChecklist, closingMissing, entryTotal } from "./payroll.rules";

const full = { photoStages: ["WORK_BEFORE", "WORK_AFTER"], diskLink: "https://disk.yandex.ru/d/x", signedKinds: ["CONTRACT", "ACCEPTANCE", "WORKS"] } as never;

describe("условия закрытия машины", () => {
  it("всё выполнено — не хватает ничего", () => {
    expect(closingMissing(closingChecklist(full))).toEqual([]);
  });

  it("без фото «после» закрыть нельзя", () => {
    const missing = closingMissing(closingChecklist({ ...(full as object), photoStages: ["WORK_BEFORE"] } as never));
    expect(missing).toEqual(["Фото «после» работ"]);
  });

  it("фото приёмки не заменяют фото работ", () => {
    const missing = closingMissing(closingChecklist({ ...(full as object), photoStages: ["RECEPTION", "ISSUE"] } as never));
    expect(missing).toEqual(["Фото «до» работ", "Фото «после» работ"]);
  });

  it("пустая или пробельная ссылка не считается", () => {
    expect(closingMissing(closingChecklist({ ...(full as object), diskLink: "  " } as never))).toEqual(["Ссылка на фотоотчёт (Яндекс.Диск)"]);
  });

  it("нужны все три подписанных документа", () => {
    const missing = closingMissing(closingChecklist({ ...(full as object), signedKinds: ["CONTRACT"] } as never));
    expect(missing).toEqual(["Акт приёма-передачи подписан", "Акт выполненных работ подписан"]);
  });
});

describe("entryTotal", () => {
  it("ставка плюс доп. выплаты", () => {
    expect(entryTotal(1000, [{ amountRub: 200 }, { amountRub: 300 }])).toBe(1500);
    expect(entryTotal(1000, [])).toBe(1000);
  });
});
