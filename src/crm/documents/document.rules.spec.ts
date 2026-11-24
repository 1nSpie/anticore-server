import { buildIssuer, formatDocNumber } from './document.rules';
import { documentMissing, type DocumentReadinessInput } from './document-readiness';
import { INTERIOR_KEYS, SYSTEM_KEYS } from '../inspection/inspection.rules';

describe('номер документов', () => {
  it('префикс филиала и шестизначный порядковый номер', () => {
    expect(formatDocNumber('Р', 125)).toBe('Р-000125');
    expect(formatDocNumber('К', 1)).toBe('К-000001');
    expect(formatDocNumber('Ж', 1234567)).toBe('Ж-1234567');
  });
});

describe('реквизиты исполнителя в снимке', () => {
  it('собираются из организации и филиала', () => {
    const issuer = buildIssuer(
      { fullName: 'ИП Стражников А.Л.', brandName: 'АванКор', inn: '1', ogrnip: '2', legalAddress: 'L', phone: 'P', email: 'E', signerName: 'Стражников А.Л.' },
      { city: 'Коломна', address: 'адрес', docPrefix: 'К' },
    );
    expect(issuer.title).toBe('ИП Стражников А.Л. ; АванКор Коломна');
    expect(issuer.titleInBrackets).toBe('ИП Стражников А.Л. (АванКор Коломна)');
    expect(issuer.branchAddress).toBe('адрес');
  });
});

const input = (): DocumentReadinessInput => ({
  client: { lastName: 'Иванов', firstName: 'Иван', birthDate: new Date('1990-05-01') },
  vehicle: { carId: 5, customLabel: null, year: 2019, vin: 'XWEHN512BK0123456', plate: 'А123ВС77' },
  inspection: {
    receivedAt: new Date(), receivedById: 3, mileageKm: 120000, fuelPercent: 40, keysCount: 2, noDefectsConfirmed: true,
    interior: Object.fromEntries(INTERIOR_KEYS.map((k) => [k, 'NONE'])),
    systems: Object.fromEntries(SYSTEM_KEYS.map((k) => [k, { status: 'OK' }])),
    dataVerifiedAt: new Date(),
  },
  marksCount: 0,
  visit: { startsAt: new Date(), endsAt: new Date(), serviceType: 'Комплексная', completedAt: new Date() },
  worksCount: 1,
  preliminaryPrice: 45000,
  execution: {
    agreed: [{ title: 'Антикоррозийная обработка', status: 'DONE' }],
    extras: [],
    actualTotal: 45000,
    handover: { issuedAt: new Date(), warrantyBookIssued: true, warrantyTermsExplained: true, warrantyMonths: 12, warrantyStartsAt: new Date() },
  },
  has: { CONTRACT: true, ACCEPTANCE: true },
});
const labels = (kind: 'CONTRACT' | 'ACCEPTANCE' | 'WORKS', i: DocumentReadinessInput) => documentMissing(kind, i).map((m) => m.label);

describe('готовность документов', () => {
  it('полностью заполненная запись готова для всех трёх документов', () => {
    for (const k of ['CONTRACT', 'ACCEPTANCE', 'WORKS'] as const) expect(labels(k, input())).toEqual([]);
  });

  it('договору нужны дата рождения, пробег и подтверждённая проверка данных', () => {
    const i = input();
    i.client.birthDate = null;
    i.inspection!.mileageKm = null;
    i.inspection!.dataVerifiedAt = null;
    expect(labels('CONTRACT', i)).toEqual([
      'Дата рождения клиента',
      'Пробег',
      'Подтверждение проверки данных (VIN сверен с маркировкой)',
    ]);
  });

  it('договору не нужна полностью заполненная приёмка, акту приёма — нужна', () => {
    const i = input();
    i.inspection!.keysCount = null;
    expect(labels('CONTRACT', i)).toEqual([]);
    expect(labels('ACCEPTANCE', i)).toEqual(['Количество ключей']);
  });

  it('без приёмки договор не формируется', () => {
    const i = { ...input(), inspection: null };
    expect(labels('CONTRACT', i)).toContain('Приёмка не начата');
  });

  it('договору нужны сроки, услуга и цена', () => {
    const i = input();
    i.visit = { startsAt: null, endsAt: null, serviceType: '  ', completedAt: null };
    i.worksCount = 0;
    i.preliminaryPrice = null;
    expect(labels('CONTRACT', i)).toEqual(['Плановое начало работ', 'Плановое окончание работ', 'Согласованные работы (перечень)', 'Предварительная стоимость']);
  });

  it('акт работ ждёт договор и акт приёма', () => {
    const i = input();
    i.has = { CONTRACT: false, ACCEPTANCE: false };
    expect(labels('WORKS', i)).toEqual(['Договор не сформирован', 'Акт приёма-передачи не сформирован']);
  });

  it('акт работ: незавершённая работа и несогласованная допработа мешают формированию', () => {
    const i = input();
    i.execution.agreed = [{ title: 'Работа А', status: 'IN_PROGRESS' }, { title: 'Работа Б', status: 'CANCELLED' }, { title: 'Работа В', status: 'DONE' }];
    i.execution.extras = [
      { title: 'Допработа 1', status: 'NEEDS_APPROVAL', approvalStatus: 'PENDING' },
      { title: 'Допработа 2', status: 'WAITING', approvalStatus: 'APPROVED' },
      { title: 'Допработа 3', status: 'CANCELLED', approvalStatus: 'REJECTED' },
    ];
    expect(labels('WORKS', i)).toEqual([
      'Работа не завершена: Работа А',
      'Допработа не согласована с клиентом: Допработа 1',
      'Допработа не выполнена: Допработа 2',
    ]);
  });

  it('акт работ: без выдачи и гарантии не формируется, срок гарантии нужен, только если книжка выдана', () => {
    const i = input();
    i.execution.handover = null;
    expect(labels('WORKS', i)).toEqual([
      'Фактические дата и время выдачи автомобиля',
      'Гарантийная книжка: выдана или нет',
      'Гарантийные условия: разъяснены или нет',
    ]);
    i.execution.handover = { issuedAt: new Date(), warrantyBookIssued: true, warrantyTermsExplained: true, warrantyMonths: null, warrantyStartsAt: null };
    expect(labels('WORKS', i)).toEqual(['Срок гарантии', 'Начало срока гарантии']);
    i.execution.handover = { issuedAt: new Date(), warrantyBookIssued: false, warrantyTermsExplained: false, warrantyMonths: null, warrantyStartsAt: null };
    expect(labels('WORKS', i)).toEqual([]);
  });

  it('акт работ: цена каждой выполненной работы обязательна', () => {
    const i = input();
    i.execution.actualTotal = null;
    expect(labels('WORKS', i)).toEqual(['Стоимость каждой выполненной работы']);
  });

  it('цена 0 ₽ — допустимое значение, а «не указана» — нет', () => {
    const i = input();
    i.worksCount = 0;
    i.preliminaryPrice = 0;
    expect(labels('CONTRACT', i)).toEqual([]);
    i.preliminaryPrice = null;
    expect(labels('CONTRACT', i)).toEqual(['Предварительная стоимость']);
    i.worksCount = 3; // в перечне есть позиция без цены
    expect(labels('CONTRACT', i)).toEqual(['Стоимость каждой работы в перечне']);
  });
});
