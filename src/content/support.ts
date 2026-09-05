import type { SupportOffer } from '../supportTypes';

// GAME_DESIGN.md §15。人物・品物・金額は差し替え可能な検証データ。
export const capabilityLabels: Record<string, string> = {
  'flexible-orders': '納品方法を選べる注文',
  'extended-credit': '追加の掛け仕入れ',
};
export const legacyOffers: SupportOffer[] = [
  {
    id: 'reservation', title: '前金付きの予約注文', person: 'claire', kind: 'advance',
    description: '報酬の一部を先に受け取り、期限までに調合品を納める。',
    opens: 1, closes: 10, term: 7, acceptDays: 0,
    money: 160, materials: {}, totalPay: 340, repayment: 160,
    requirements: [], unlocks: ['flexible-orders'], extensionDays: 3, extensionLimit: 1,
    options: [{ id: 'standard', label: '指定品を納める', recipe: 'tisane', count: 2, days: 1, stamina: 12, unlocks: [] }],
  },
  {
    id: 'supply-credit', title: '素材の掛け仕入れ', person: 'vernet', kind: 'credit',
    description: '代金を後払いにして、素材をまとめて持ち帰る。',
    opens: 1, closes: 12, term: 8, acceptDays: 1,
    money: 0, materials: { rose: 6, wormwood: 3 }, totalPay: 0, repayment: 138,
    requirements: [], options: [], unlocks: ['extended-credit'], extensionDays: 3, extensionLimit: 1,
  },
  {
    id: 'flexible-reservation', title: '納品方法を選ぶ予約注文', person: 'claire', kind: 'advance',
    description: '手持ちの品と残り日数を見て、納め方を選べる。',
    opens: 1, closes: 14, term: 6, acceptDays: 0,
    money: 120, materials: {}, totalPay: 360, repayment: 120,
    requirements: [{ kind: 'capability', id: 'flexible-orders' }],
    unlocks: [], extensionDays: 3, extensionLimit: 1,
    options: [
      { id: 'regular', label: '指定品をまとめて納める', recipe: 'tisane', count: 2, days: 1, stamina: 12, unlocks: [] },
      { id: 'alternative', label: '代替品を説明して納める', recipe: 'sleeper', count: 1, days: 2, stamina: 8, unlocks: [] },
    ],
  },
  {
    id: 'extended-supply', title: '追加の掛け仕入れ', person: 'vernet', kind: 'credit',
    description: '一度支払いを終えた取引先から、別の素材を仕入れる。',
    opens: 1, closes: 14, term: 9, acceptDays: 1,
    money: 0, materials: { wax: 3, poppy: 4, wormwood: 4 }, totalPay: 0, repayment: 235,
    requirements: [{ kind: 'capability', id: 'extended-credit' }],
    options: [], unlocks: [], extensionDays: 3, extensionLimit: 1,
  },
];

// 日程・人物・素材は検証用。シナリオを変更するときはこの定義を差し替える。
export const specialOffers: SupportOffer[] = [
  { id: 'special-a', title: '特別依頼A：紹介の薬湯', person: 'claire', kind: 'advance',
    description: '指定日に薬湯を届けると、新たな協力者を紹介してもらえる。',
    opens: 2, closes: 5, term: 1, acceptDays: 0, schedule: { appears: 2, closes: 5, delivery: 8 },
    money: 160, materials: {}, totalPay: 360, repayment: 160, requirements: [], unlocks: [], extensionDays: 1, extensionLimit: 0,
    options: [{ id: 'standard', label: '薬湯を納める', recipe: 'tisane', count: 2, days: 1, stamina: 12, unlocks: [] }],
    rewards: [{ kind: 'relation', person: 'claire', amount: 1 }, { kind: 'person', id: 'herbalist' }] },
  { id: 'special-b', title: '特別依頼B：薬草園への橋渡し', person: 'vernet', kind: 'advance',
    description: '次の章の指定日に薬湯を届ける。薬草園への紹介と、短い出来事が待っている。',
    opens: 9, closes: 12, term: 1, acceptDays: 0, schedule: { appears: 9, closes: 12, delivery: 15 },
    money: 180, materials: {}, totalPay: 400, repayment: 180, requirements: [], unlocks: [], extensionDays: 1, extensionLimit: 0,
    options: [{ id: 'standard', label: '薬湯を納める', recipe: 'tisane', count: 2, days: 1, stamina: 12, unlocks: [] }],
    rewards: [{ kind: 'place', id: 'garden' }, { kind: 'event', id: 'garden-introduction' }, { kind: 'recipe', id: 'balm' }, { kind: 'capability', id: 'garden-orders' }] },
];
export const supportOffers = [...specialOffers, ...legacyOffers.filter(o => o.kind === 'credit')];
capabilityLabels['garden-orders'] = '薬草園向けの追加依頼';
