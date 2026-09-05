import type { SupportOffer } from '../supportTypes';

// GAME_DESIGN.md §14。人物・品物・金額は差し替え可能な検証データ。
export const capabilityLabels: Record<string, string> = {
  'flexible-orders': '納品方法を選べる注文',
  'extended-credit': '追加の掛け仕入れ',
};
export const supportOffers: SupportOffer[] = [
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
