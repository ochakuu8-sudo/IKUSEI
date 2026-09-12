import type { Job, SceneLine } from "../game";
import type { Scenario, AdvNode, Choice, Condition } from "../adv/types";

const skill = (id: string): Condition => ({ kind: "range", value: { kind: "skill", id }, min: 1 });
const line = (text: string, speaker?: string): SceneLine => ({ text, ...(speaker ? { speaker } : {}) });
const text = (id: string, lines: SceneLine[], next = "end"): AdvNode => ({ id, kind: "text", lines, next });
const end = (flags: Record<string, boolean> = {}): AdvNode => ({ id: "end", kind: "end", effects: { storyFlags: flags } });
const scenario = (id: string, nodes: Record<string, AdvNode>): Scenario => ({ id, version: 1, entry: "intro", nodes });

const intro = scenario("ch1.intro", {
  intro: text("intro", [
    line("朝の光の中で、エレオノールは封を切った。宛名だけは以前と同じ、ラティエ家の令嬢宛てだった。"),
    line("けれど、中に入っていたのは招待状ではない。十四日後を期限とする、最初の返済通知だった。"),
    line("今期のお支払いは千五十。全額をお預かりしても、ご実家の借金は残ります。", "ヴェルネ"),
    line("承知しています。……手元には、百二十しかありません。", "エレオノール"),
    line("商会には帳簿の仕事があります。学院の司書にも、手伝いを探していると聞きました。選ぶのはあなたです。", "ヴェルネ"),
    line("家名があるから任せてもらえる仕事と、覚えなければ任せてもらえない仕事。その違いを、彼は言い添えなかった。"),
    line("一日に引き受けられる仕事は一つ。疲れを残したまま翌朝を迎えることもある。休めば体力は戻るが、期限は待たない。"),
    line("返済に足りない分は、四分の一の利息とともに次へ持ち越される。世間の扱いも厳しくなるという。"),
    line("それでも、今日の返事は自分で書ける。エレオノールは二通の依頼状を並べ、ペンを取った。"),
  ]), end: end({ "ch1.intro.done": true }),
});

const ledgerChoices: Choice[] = [
  { id: "cash", text: "伝票を多く処理して、手当を受け取る", effects: { bonusMoney: 65 }, next: "cash" },
  { id: "negotiation", text: "取引の照合を教わる", effects: { growthXP: { negotiation: 1 } }, next: "learn" },
  { id: "courage", text: "窓口で確認の説明を担当する", effects: { growthXP: { courage: 1 } }, next: "learn" },
];
const libraryChoices: Choice[] = [
  { id: "cash", text: "返却本を多く片付けて、手当を受け取る", effects: { bonusMoney: 40 }, next: "cash" },
  { id: "knowledge", text: "索引と資料の読み方を教わる", effects: { growthXP: { knowledge: 1 } }, next: "learn" },
  { id: "charm", text: "閲覧者への案内を担当する", effects: { growthXP: { charm: 1 } }, next: "learn" },
];
function basic(id: string, speaker: string, first: SceneLine[], repeat: string, choices: Choice[]) {
  const nodes = (opening: SceneLine[]): Record<string, AdvNode> => ({
    intro: text("intro", opening, "role"),
    role: { id: "role", kind: "choice", prompt: "今日は何を優先する？", choices },
    cash: text("cash", [line("今日は数をこなすことに集中した。手当の分だけ封筒が重くなる。新しい仕事の練習は、また別の日だ。")]),
    learn: text("learn", [line("時間をかけて、一つずつやってみましょう。二度経験すれば、次の仕事で使えるはずです。", speaker), line("すぐに手当は増えない。それでも、昨日は人に尋ねたことを、今日は自分で判断できた。")]),
    end: end({ [id + ".seen"]: true }),
  });
  return [scenario(id, nodes(first)), scenario(id + ".repeat", nodes([line(repeat, speaker)]))];
}
const basics = [
  ...basic("ch1.ledger", "ヴェルネ", [
    line("商会の机には、品名と金額を記した伝票が積まれていた。家で見ていた帳簿と違い、一枚ごとに今日働いた人の名前がある。"),
    line("枚数をこなせば六十五の手当を付けます。取引の照合や窓口の説明を学ぶなら、今日は基本の報酬だけです。", "ヴェルネ"),
    line("教わる時間にも、お金を頂けるのですか。", "エレオノール"),
    line("次に任せられる人を育てるのも仕事です。ただ、あなたの返済期限まで延びるわけではありません。", "ヴェルネ"),
  ], "今日も伝票が届いています。枚数をこなすか、照合や説明を練習するか。残りの日数も見て決めてください。", ledgerChoices),
  ...basic("ch1.library", "クレール", [
    line("学院の書庫は静かだった。クレールは椅子の埃を払い、エレオノールのために机の半分を空けた。"),
    line("ここでは、分からないことを聞いても叱られません。私も、知らない資料に毎日出会いますから。", "クレール"),
    line("返却本を多く片付けるなら四十の手当。索引の読み方か、閲覧者への案内を覚えるなら、その時間を取りましょう。", "クレール"),
    line("指先で背表紙をなぞる。古い名前を知っていることと、誰かに必要な一冊を見つけることは、違う仕事だった。"),
  ], "お帰りなさい。返却本を片付ける日にも、調べ方や案内を学ぶ日にもできます。今日はどうしましょう。", libraryChoices),
];

function skilled(id: string, speaker: string, first: SceneLine[], repeat: string, choices: Choice[], answers: Record<string, string>) {
  const nodes = (opening: SceneLine[]): Record<string, AdvNode> => ({
    intro: text("intro", opening, "role"),
    role: { id: "role", kind: "choice", prompt: "どこまで任せてもらう？", choices },
    normal: text("normal", [line("今日は補助の仕事を確実に終えた。引き受けなかった役割の手当は付かないが、仕事を投げ出したわけではない。")]),
    ...Object.fromEntries(Object.entries(answers).map(([key, body]) => [key, text(key, [line(body, speaker), line("教わったことが、今日の報酬になった。次も同じ役割を選べる。どれだけ続けるかは、残りの日数と体力次第だ。")])])),
    end: end({ [id + ".seen"]: true }),
  });
  return [scenario(id, nodes(first)), scenario(id + ".repeat", nodes([line(repeat, speaker)]))];
}
const skilledWork = [
  ...skilled("ch1.negotiation", "ヴェルネ", [
    line("納入日を巡る行き違いが起きていた。声を荒らげる取引先を前に、ヴェルネは伝票を二枚並べた。"),
    line("条件を整理するか、こちらの説明を皆に伝えるか。経験があれば任せます。補助だけでも構いません。", "ヴェルネ"),
    line("机の隅に控えるだけでは見えなかった、相手が譲れない事情がある。エレオノールは二枚の日付を見比べた。"),
  ], "今日の照合にも説明が必要です。覚えた役割を続けても、補助に回っても構いません。", [
    { id: "normal", text: "書類の準備と記録を担当する", next: "normal" },
    { id: "negotiation", text: "双方の納入条件を調整する", condition: skill("negotiation"), hint: "商会の帳簿で交渉経験を2積む", effects: { bonusMoney: 100, storyFlags: { "ch1.negotiated": true } }, next: "negotiation" },
    { id: "courage", text: "商会の回答を自分で伝える", condition: skill("courage"), hint: "商会の窓口で胆力経験を2積む", effects: { bonusMoney: 100, storyFlags: { "ch1.spoke": true } }, next: "courage" },
  ], { negotiation: "両方の事情を残した取り決めです。家名で押し切るより、次も頼みやすい。", courage: "言いにくい部分まで、ご自分の言葉で伝えてくれましたね。説明役の手当を付けます。" }),
  ...skilled("ch1.research", "クレール", [
    line("閲覧室には、同じ町の名前を持つ二冊の記録が開かれていた。書かれた収穫量は、大きく違っている。"),
    line("資料の前提を調べる役と、調べに来た方の事情を聞く役が必要です。どちらも、ただ読むだけでは終わりません。", "クレール"),
    line("以前なら、詳しい人に任せて席を離れただろう。今日は、書庫で教わった索引の位置を覚えている。"),
  ], "次の調査が届きました。資料を読み解くか、閲覧者から聞き取るか。補助の整理だけでも助かります。", [
    { id: "normal", text: "資料の運搬と整理を担当する", next: "normal" },
    { id: "knowledge", text: "資料の前提の違いを調べる", condition: skill("knowledge"), hint: "学院の索引で知見経験を2積む", effects: { bonusMoney: 105, storyFlags: { "ch1.researched": true } }, next: "knowledge" },
    { id: "charm", text: "閲覧者の事情を聞き出す", condition: skill("charm"), hint: "学院の案内で魅力経験を2積む", effects: { bonusMoney: 105, storyFlags: { "ch1.listened": true } }, next: "charm" },
  ], { knowledge: "片方は税の記録、もう片方は実際の収穫でした。違いを説明できれば、二冊とも役に立ちます。", charm: "知りたいのは収穫量そのものではなかったんですね。お話を聞いてくれたおかげで、必要な資料が分かりました。" }),
];

const promise = scenario("ch1.promise", {
  intro: text("intro", [
    line("七日目の夜。返済通知の隣に、二通の短い手紙が置かれていた。"),
    line("十日目から期限までの間に、取り決めの最終確認をお願いしたい。引き受けるなら席を空けておきます。", "ヴェルネ"),
    line("整理した資料を、外へ貸し出す準備をしています。最後の確認を一緒にしていただけませんか。", "クレール"),
    line("どちらも、まだ知らない仕事だ。両方の約束を抱えるには、残りの日数が心許ない。"),
    line("これまで何を選んできても、返事を書くことはできる。エレオノールは、先に果たしたい約束を一つ決めた。"),
  ], "promise"),
  promise: { id: "promise", kind: "choice", prompt: "後半に引き受ける約束は？", choices: [
    { id: "vernet", text: "商会で、次の取り決めを仕上げる", effects: { storyFlags: { "ch1.promise.vernet": true, "ch1.promise.claire": false } }, next: "vernet" },
    { id: "claire", text: "学院で、資料を届ける準備をする", effects: { storyFlags: { "ch1.promise.claire": true, "ch1.promise.vernet": false } }, next: "claire" },
  ] },
  vernet: text("vernet", [line("引き受けます。条件を確かめて、自分の名前でお返事します。", "エレオノール"), line("商会宛ての封筒を閉じた。十日目から十四日目まで、約束の依頼が届く。受ける日も、自分で選べる。")]),
  claire: text("claire", [line("伺います。必要とする方に、きちんと渡せる形にしましょう。", "エレオノール"), line("学院宛ての封筒を閉じた。十日目から十四日目まで、約束の依頼が届く。受ける日も、自分で選べる。")]),
  end: end({ "ch1.promise.done": true }),
});
const vernetPromise = scenario("ch1.vernet-promise", {
  intro: text("intro", [
    line("約束の書類には、エレオノールの名前が担当者として記されていた。ヴェルネは最後の一枚を、まだ渡さずにいる。"),
    line("通常の確認だけで、約束は果たせます。もう一件、百の追加手当を付けられる話もあります。", "ヴェルネ"),
    line("商会の広告に、没落したラティエ家の令嬢が働く姿を載せたい、と。仕事より、家の転落に目を向けさせる文面です。", "ヴェルネ"),
    line("広告は撤回しても、人の記憶から消えない。引き受ければ威厳の数値が二十五下がり、失ったランクは休んでも戻らない。断っても、この依頼は完了できる。"),
  ], "terms"),
  terms: { id: "terms", kind: "choice", prompt: "追加の広告契約をどうする？", choices: [
    { id: "refuse", text: "広告は断り、約束した仕事を終える", next: "refuse" },
    { id: "accept", text: "家名を広告に使わせ、追加手当を得る", effects: { bonusMoney: 100, axisDelta: { 威厳: -25 }, storyFlags: { "ch1.advertised": true } }, next: "accept" },
  ] },
  refuse: text("refuse", [line("その条件は引き受けません。今日の確認については、最後まで責任を持ちます。", "エレオノール"), line("ヴェルネは広告の紙だけを引き戻した。交渉は決裂せず、通常の書類に二人の署名が残った。")]),
  accept: text("accept", [line("文面を読みました。……その分の手当も、受け取ります。", "エレオノール"), line("署名した名前は同じでも、街でどう呼ばれるかは変わるだろう。封筒の重さを確かめてから、彼女は残りの確認を終えた。")]),
  end: end({ "ch1.followup.vernet": true }),
});
const clairePromise = scenario("ch1.claire-promise", {
  intro: text("intro", [
    line("貸出用の箱には、資料だけでなく、読む順番を書いた小さな紙が入っていた。最後の一枚は、まだ白い。"),
    line("届けた先で、私たちが隣に立って説明できるとは限りません。受け取る方のために、一言添えてもらえますか。", "クレール"),
    line("エレオノールは、最初にここへ来た日のことを思い出した。知らないことを尋ねてもいいと言われて、ようやく椅子に座れた。"),
  ], "note"),
  note: { id: "note", kind: "choice", prompt: "資料に何を書き添える？", choices: [
    { id: "welcome", text: "分からないことは、学院へ尋ねてほしい", effects: { growthXP: { charm: 1 } }, next: "done" },
    { id: "guide", text: "調べた前提と、資料を読む順番を伝える", effects: { growthXP: { knowledge: 1 } }, next: "done" },
  ] },
  done: text("done", [line("これは、あなたがここで覚えたことですね。私の名前だけで出すのは惜しいです。", "クレール"), line("二人で送り主の欄を書き、箱を閉じた。家から持ち出した品を売ったのではない。自分が加えた一枚に、報酬が支払われた。")]),
  end: end({ "ch1.followup.claire": true }),
});

// 精算値は保存済みの明細から組み立てる。本文の選択や回想から再精算しない。
export function chapterOneEndingLines(s: { storyFlags: Record<string, boolean>; chapterResults: { chapter: number; paid: number; shortfall: number; interest: number }[] }): SceneLine[] {
  const receipt = s.chapterResults.find(r => r.chapter === 1);
  const merchant = !!s.storyFlags["ch1.promise.vernet"];
  const kept = !!s.storyFlags["ch1.followup." + (merchant ? "vernet" : "claire")];
  return [
    line("十四日分の印が埋まった暦を、エレオノールは返済通知の横に置いた。最初の日より、紙を押さえる手が迷わない。"),
    line(receipt?.shortfall ? `${receipt.paid.toLocaleString()}Gを納めた。不足は${receipt.shortfall.toLocaleString()}G、利息は${receipt.interest.toLocaleString()}G。残った支払いと、厳しくなった扱いは、次の日々へ持ち越す。` : `${(receipt?.paid ?? 0).toLocaleString()}G。最初の支払いを、期限に間に合わせた。家の借金すべてを消せたわけではない。それでも、確かに一行が済んだ。`),
    ...(merchant ? [
      line(kept ? "あなたが仕上げた取り決めは、次の取引でも使います。次も、内容を見て返事をください。" : "今回は確認の席を閉じました。果たせなかった約束は残りますが、次の仕事まで断るつもりはありません。", "ヴェルネ"),
      line(s.storyFlags["ch1.advertised"] ? "街へ出た広告は、もう手元には戻らない。選んだ代償と、得た報酬。どちらも自分の記録として、彼女は帳簿に挟んだ。" : "返済の受領書と、仕事の控え。家に届く紙のすべてが、失ったものの通知ではなくなった。"),
      line("今度は、先に条件を読ませてください。そのうえで、私が引き受けます。", "エレオノール"),
    ] : [
      line(kept ? "資料を受け取った方から、お礼が届きました。あなたの書き添えた一枚も、役に立ったそうです。" : "箱は私から送りました。ご一緒できなかったのは残念ですが、机の席はそのまま空けてあります。", "クレール"),
      line("返事の宛名には、ラティエ家だけでなく、エレオノールの名前があった。知っていること、教わったことを必要とする相手がいる。"),
      line("また伺います。次は、私から調べたいことを持って。", "エレオノール"),
    ]),
    line("翌朝のために机を片付ける。残ったお金も、身に付いた経験も、交わした約束も、ここでなくなるわけではない。"),
    line("引き出しに、新しい封筒が一通。まだ開けていない手紙を残して、最初の二週間は終わった。"),
  ];
}
const ending = scenario("ch1.ending", { intro: text("intro", [line("最初の二週間を、帳簿に綴じる。")]), end: end({ "ch1.ending.done": true }) });
for (const event of [intro, promise, ending]) for (const node of Object.values(event.nodes))
  if (node.kind === "text") node.lines = node.lines.map(l => ({ ...l, visual: "chapter.home" }));
export function chapterOneEnding(s: Parameters<typeof chapterOneEndingLines>[0]): Scenario {
  return { ...structuredClone(ending), nodes: { intro: text("intro", chapterOneEndingLines(s).map(l => ({ ...l, visual: "chapter.home" }))), end: end({ "ch1.ending.done": true }) } };
}


/* ===== 試作：夜会の片付けと給仕（マルク） =====
   受け取った原稿をそのままノベルへ割り当てた検証用の依頼。
   報酬・体力・選択の効果はすべて仮値。条件は未設定（全選択が無条件）。
   本番では尊厳ランクで届く段階を決める想定（旧データの「個室での接待」は
   opensBelow: { 貞操: 3 } で、貞操が落ちてから初めて届いていた）。 */
const cleanupChoiceNodes: Record<string, AdvNode> = {
  intro: text("intro", [
    line("指定された別邸の奥室に入ると、むっとするような酒と脂、そして精液の生臭い匂いが室内に立ち込めていた。"),
    line("ソファーには半裸の商人たちが泥酔して転がり、床には倒れたグラスと散らばった料理の残骸が散乱している。"),
    line("おう、来たな。仕事は簡単な拭き掃除だ。……ただ、奥のソファーにいる旦那の処理が残っててな", "マルク"),
    line("案内された奥の暗がりでは、腹の出た太った男がズボンを膝まで下ろし、真っ赤に怒張した肉棒を露出させていた。"),
    line("男は下品な笑みを浮かべ、エレオノールの金髪と整った顔立ちを卑しい視線で舐め回すように見つめてくる。"),
    line("おい、マルク。この女が噂の没落令嬢か？ 面白え、俺のこのカチカチのナニを気持ちよくさせてみろ", "男"),
    line("だそうだ。床の清掃だけで終わらせるか、旦那のナニを処理して特別手当てをもらうか、お前が決めな", "マルク"),
  ], "role"),
  role: {
    id: "role", kind: "choice", prompt: "どのような対応を取る？",
    choices: [
      { id: "refuse", text: "床の拭き掃除だけを淡々とこなす", next: "refuse" },
      { id: "hand", text: "男のペニスを手で握り、しごいて吐き出させる",
        effects: { bonusMoney: 120, axisDelta: { 貞操: -12 } }, next: "hand" },
      { id: "oral", text: "膝をつき、ペニスを咥え込んで吐き出させる",
        effects: { bonusMoney: 220, axisDelta: { 貞操: -20 } }, next: "oral" },
    ],
  },
  refuse: text("refuse", [
    line("エレオノールは男の太い肉棒から視線を逸らし、黙って雑巾をバケツの水に浸した。"),
    line("床に散らばる酒の汚れと吸い殻を淡々と拭き取り、男の存在など最初から視界に入っていないかのように振る舞う。"),
    line("ちっ、すました顔しやがって。没落したくせにプライドだけは一人前かよ。失せろ、シケた女だ！", "男"),
    line("男は苛立ちを露わにして唾を吐き捨て、エレオノールの腰を乱暴に蹴り飛ばすと、別の女を呼ぶために部屋を出て行った。"),
    line("背中に走る痛みを無視し、エレオノールは汚れた布を絞り直すと、冷ややかな手つきで黙々と掃除を続けた。"),
  ]),
  hand: text("hand", [
    line("エレオノールは男の足元に膝をつき、ドレスの裾を払うと、太く脈打つペニスへと細い手指を伸ばした。"),
    line("先端から滲み出る生臭い愛液の粘りけが皮膚に伝わり、先端の亀頭は握りきれないほど不恰好に腫れ上がっている。"),
    line("ひひっ、いい手つきだ。元貴族様の気高い指先で、もっと強く根元から擦り上げてくれよ！", "男"),
    line("両手で肉棒を包み込み、一定のリズムで上下にしごき立てると、男は歓喜の声を上げてエレオノールの頭を撫でまわした。"),
    line("親指で亀頭の切れ目を擦り上げるたび、男は腰を跳ねさせ、大量の我慢汁をエレオノールの手首まで滴らせていく。"),
    line("「くふっ、来るぞ……ッ！ 元令嬢の手の中で出してやる！」"),
    line("男の全身が激しく強張ると同時に、熱くドロドロとした精液が勢いよく噴出し、エレオノールの手とドレスの袖口を真っ白に汚した。"),
    line("脈打つ肉棒が萎えていくのを冷ややかに見届けた後、エレオノールは精液塗れの手をぬぐい、差し出された重い金貨を受け取った。"),
  ]),
  oral: text("oral", [
    line("エレオノールは躊躇うことなく男の股間に顔を近づけ、露わになった肉棒にそっと唇を寄せた。"),
    line("鼻腔を突く強い男臭さと精液の匂いに眉ひとつ動かさず、湿った亀頭の先を舌先で丁寧に舐め回していく。"),
    line("「うおっ、うまいぞ！ 唇を密着させて、もっと奥までぐっぽりと咥え込め！」"),
    line("男は興奮のあまりエレオノールの金髪を掴み、喉の奥深くまで太いペニスを強引に突き刺してきた。"),
    line("息が詰まり、目元に生理的な涙が浮かぶが、エレオノールは舌を複雑に絡め、口腔全体で肉棒を強く絞り上げた。"),
    line("ジュポ、ジュボと卑しい水音が部屋に響き渡り、男は獣のような喘ぎ声を上げながらエレオノールの頭を激しく前後させる。"),
    line("「くそっ、最高だ！ 落ちぶれた令嬢の喉奥に直接ぶち込んでやる！」"),
    line("男の腰が大きく跳ね、爆発的な勢いで熱く濃厚な精液がエレオノールの喉元へ直接噴射された。"),
    line("何度も喉を鳴らして大量の精液を飲み込み、溢れ出た白濁液が顎を伝って胸元へと滴り落ちていく。"),
    line("ペニスが吐き出された後も、エレオノールは舌先で残った精液を綺麗に舐め取り、静かに口元を拭って礼をした。"),
    line("大満足した男から投げつけられた金貨の袋を拾い上げると、何事もなかったかのようにバケツを持ち、次の部屋へと向かった。"),
  ]),
  end: end({ "ch1.cleanup.seen": true }),
};
const cleanup = scenario("ch1.cleanup", cleanupChoiceNodes);
const cleanupRepeat = scenario("ch1.cleanup.repeat", {
  ...cleanupChoiceNodes,
  intro: text("intro", [
    line("今日も奥の部屋で宴会の後片付けがある。体を使う準備はできてるな？", "マルク"),
  ], "role"),
});

export const chapterOneScenarios = [intro, ...basics, ...skilledWork, promise, vernetPromise, clairePromise, cleanup, cleanupRepeat, ending];
const job = (id: string, title: string, person: Job["person"], pay: number, stamina: number, extra: Partial<Job>): Job => ({
  id: "ch1-" + id, scenarioId: "ch1." + id, title, person, pay, stamina, kind: "実務", category: "ordinary", cadence: "repeat", needs: {}, costs: [], bond: 0,
  description: "", ...extra,
});
export const chapterOneJobs: Job[] = [
  job("ledger", "商会の帳簿仕事", "vernet", 95, 20, { repeatScenarioId: "ch1.ledger.repeat", growthHint: "手当 +65G、または交渉・胆力の経験 +1", description: "毎日受付。手当を優先するか、取引の照合・窓口の説明を学ぶか選べます。同じ経験を2積むと、取引の確認で専門の役割を担当できます。" }),
  job("library", "学院の書庫整理", "claire", 80, 16, { repeatScenarioId: "ch1.library.repeat", growthHint: "手当 +40G、または知見・魅力の経験 +1", description: "毎日受付。返却本の整理で手当を得るか、索引・閲覧案内を学ぶか選べます。同じ経験を2積むと、資料調査で専門の役割を担当できます。" }),
  job("negotiation", "取引の最終確認", "vernet", 120, 25, { repeatScenarioId: "ch1.negotiation.repeat", availableFromDay: 3, bond: 1, growthHint: "交渉か胆力1段階で手当 +100G。補助は条件なし", description: "3日目以降、学院の調査と日替わりで受付。交渉か胆力を使う役割なら、受けるたびに追加手当。経験が足りなくても書類の準備を担当できます。" }),
  job("research", "食い違う資料の調査", "claire", 105, 22, { repeatScenarioId: "ch1.research.repeat", availableFromDay: 3, bond: 1, growthHint: "知見か魅力1段階で手当 +105G。補助は条件なし", description: "3日目以降、商会の確認と日替わりで受付。知見か魅力を使う役割なら、受けるたびに追加手当。経験が足りなくても運搬と整理を担当できます。" }),
  job("vernet-promise", "自分の名前で結ぶ契約", "vernet", 255, 28, { cadence: "once", bond: 1, availableFromDay: 10, availableUntilDay: 14, requiresStoryFlags: ["ch1.promise.vernet"], growthHint: "7日目の約束の続き。広告契約は断っても完了可", description: "10〜14日目の一度だけ。商会との約束を仕上げます。追加の広告契約は +100Gと引き換えに威厳の数値が25低下し、失ったランクは戻りません。契約の可否は会話中に選べます。" }),
  job("cleanup", "夜会の片付けと給仕", "marc", 140, 30, { repeatScenarioId: "ch1.cleanup.repeat", availableFromDay: 3, bond: 1,
    growthHint: "（仮）特別手当と引き換えに貞操が下がります",
    description: "商人が集まる夜会のあとの片付けだ。表の奴らには見せられねえ汚れ仕事だが、残業手当はしっかり出す。" }),
  job("claire-promise", "資料に添える一枚", "claire", 230, 22, { cadence: "once", bond: 1, availableFromDay: 10, availableUntilDay: 14, requiresStoryFlags: ["ch1.promise.claire"], growthHint: "7日目の約束の続き。知見か魅力の経験 +1", description: "10〜14日目の一度だけ。学院との約束を仕上げます。相手のために書き添える一枚を選んで、資料を送り出します。経験や尊厳による受諾条件はありません。" }),
];
