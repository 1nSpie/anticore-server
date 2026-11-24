import { itemTitle, parseSelections, type GroupDef } from './services.rules';

const groups: GroupDef[] = [
  { key: 'kind', label: 'Основные виды', multiple: true, allowCustom: false, sortOrder: 1, options: [{ name: 'Комплексная обработка', active: true }, { name: 'Базовая обработка', active: true }] },
  { key: 'addon', label: 'Дополнительные варианты', multiple: true, allowCustom: false, sortOrder: 2, options: [{ name: 'ML', active: true }, { name: 'ML + BODY', active: true }, { name: 'Старый', active: false }] },
  { key: 'detail', label: 'Уточняющие параметры', multiple: true, allowCustom: true, sortOrder: 3, options: [{ name: 'С разбором', active: true }] },
  { key: 'zones', label: 'Зоны автомобиля', multiple: true, allowCustom: true, sortOrder: 4, options: [{ name: 'Днище', active: true }, { name: 'Арки', active: true }] },
  { key: 'side', label: 'Сторона', multiple: false, allowCustom: false, sortOrder: 5, options: [{ name: 'Левая', active: true }, { name: 'Правая', active: true }] },
];

describe('параметры работ по справочнику', () => {
  it('принимает значения справочника и приводит написание к справочному', () => {
    expect(parseSelections({ kind: ['комплексная обработка'], addon: ['ml + body'] }, groups)).toEqual({
      kind: ['Комплексная обработка'], addon: ['ML + BODY'],
    });
  });

  it('значение вне справочника допустимо только там, где разрешён свой вариант', () => {
    expect(parseSelections({ detail: ['Снять защиту картера'], zones: ['Багажная ниша'] }, groups)).toEqual({
      detail: ['Снять защиту картера'], zones: ['Багажная ниша'],
    });
    expect(() => parseSelections({ kind: ['Экспресс'] }, groups)).toThrow('«Экспресс» нет в справочнике');
  });

  it('отключённое значение справочника нельзя выбрать', () => {
    expect(() => parseSelections({ addon: ['Старый'] }, groups)).toThrow('нет в справочнике');
  });

  it('одиночный выбор не принимает несколько значений', () => {
    expect(() => parseSelections({ side: ['Левая', 'Правая'] }, groups)).toThrow('только один вариант');
    expect(parseSelections({ side: ['Левая'] }, groups)).toEqual({ side: ['Левая'] });
  });

  it('убирает пустые значения и дубли, не создаёт пустых групп', () => {
    expect(parseSelections({ zones: ['Днище', ' днище ', '', '  '], kind: [] }, groups)).toEqual({ zones: ['Днище'] });
  });

  it('отклоняет неизвестный параметр, не-список, слишком длинное значение', () => {
    expect(() => parseSelections({ color: ['x'] }, groups)).toThrow('Неизвестный параметр');
    expect(() => parseSelections({ kind: 'Комплексная обработка' }, groups)).toThrow('ожидается список');
    expect(() => parseSelections({ zones: ['я'.repeat(101)] }, groups)).toThrow('длиннее 100');
    expect(() => parseSelections([], groups)).toThrow();
  });

  it('название позиции: категория, параметры по порядку группы, зоны с пометкой', () => {
    const category = { name: 'Антикоррозийная обработка', groups: groups.map(({ key, sortOrder }) => ({ key, sortOrder })) };
    expect(itemTitle(category, { zones: ['Днище', 'Арки'], kind: ['Комплексная обработка'], addon: ['ML + BODY'], detail: ['С разбором'] })).toBe(
      'Антикоррозийная обработка: Комплексная обработка; ML + BODY; С разбором; зоны: Днище, Арки',
    );
    expect(itemTitle(category, {})).toBe('Антикоррозийная обработка');
  });
});
