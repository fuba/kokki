// Internationalization: Japanese (default) and English

const ja = {
  pageTitle: '国旗生成ゲーム',
  heading: '国旗生成ゲーム',
  sectionTitle: '旗章プレビュー',
  destroyBtn: '生成',
  resultHeader: '損壊結果報告書',
  resultFlagAlt: '損壊された旗章',
  resultGeneric: '旗章を損壊しました',
  resultJapan: '日本国旗を損壊しました',
  resultCountry: (c) => `${c}っぽい国旗を損壊しました`,
  downloadBtn: '保存',
  shareXBtn: 'X',
  closeBtn: 'もう一度生成',
  footer: '本ゲームで生成される旗章は架空のものであり、既存の国旗との一致は偶然によるものです',
  warningJapanTitle: '日本国国章損壊罪の創設に係る刑法改正案（第219回国会提出）',
  warningJapanBody: () =>
    '第219回国会（令和7年）において、参政党は日本国国章損壊罪の創設を内容とする' +
    '刑法の一部を改正する法律案を参議院に提出しました。<br>' +
    '本法案では、日本国に対して侮辱を加える目的で、日本国の国旗その他の国章を損壊し、' +
    '除去し、又は汚損した者は、二年以下の拘禁刑又は二十万円以下の罰金に処するとされています。<br><br>' +
    '本法案が成立した場合、本件は同罪に該当する可能性があります。',
  warningForeignTitle: '刑法第92条（外国国章損壊等）',
  warningForeignBody: (c) =>
    `本件は${c}っぽい旗章の損壊であり、同条に該当する可能性があります。<br><br>` +
    '<strong>刑法第92条第1項</strong><br>' +
    '外国に対して侮辱を加える目的で、その国の国旗その他の国章を損壊し、除去し、' +
    '又は汚損した者は、二年以下の拘禁刑又は二十万円以下の罰金に処する。<br><br>' +
    '<strong>同条第2項</strong><br>' +
    '前項の罪は、外国政府の請求がなければ公訴を提起することができない。',
  shareText: '国旗を生成したら損壊されました',
  shareTextCountry: (c) => `${c}のような国旗を生成したら損壊されて刑法第92条に抵触しました`,
  shareTextJapan: '日本国旗を生成したら損壊されました。皆さんさようなら',
  infoFormat: (shape, bg, sc) => `${shape}｜地：${bg}｜紋：${sc}`,
  webglError: 'WebGL非対応',
  shapes: { '円': '円', '星': '星', '三日月': '三日月', '十字': '十字' },
  colors: { '白': '白', '赤': '赤', '青': '青', '緑': '緑', '黄': '黄', '黒': '黒' },
  effects: { explosion: '爆発', burn: '燃焼' },
};

const en = {
  pageTitle: 'Flag Generator Game',
  heading: 'Flag Generator Game',
  sectionTitle: 'Flag Preview',
  destroyBtn: 'Generate',
  resultHeader: 'Destruction Report',
  resultFlagAlt: 'Destroyed flag',
  resultGeneric: 'A flag has been destroyed.',
  resultJapan: 'The flag of Japan has been destroyed.',
  resultCountry: (c) => `A ${c}-ish flag has been destroyed.`,
  downloadBtn: 'Save',
  shareXBtn: 'X',
  closeBtn: 'Generate Again',
  footer: 'Flags generated in this game are fictional. Any resemblance to an existing national flag is purely coincidental.',
  warningJapanTitle: 'Bill to Create the Crime of Desecration of Japanese National Emblems (Submitted to the 219th Diet)',
  warningJapanBody: () =>
    'In the 219th session of the Diet (2025), a bill was submitted to the House of Councillors ' +
    'to amend the Penal Code by establishing the crime of desecration of Japanese national emblems.<br>' +
    'Under this bill, any person who, for the purpose of insulting Japan, damages, removes, ' +
    'or defaces the national flag or other national emblems of Japan shall be punished by ' +
    'imprisonment for not more than 2 years or a fine of not more than 200,000 yen.<br><br>' +
    'If this bill is enacted, this incident may constitute such an offense.',
  warningForeignTitle: 'Penal Code Article 92 (Damage to Foreign National Emblems)',
  warningForeignBody: (c) =>
    `This may constitute desecration of a ${c}-ish flag under Article 92.<br><br>` +
    '<strong>Article 92, Paragraph 1</strong><br>' +
    'A person who, for the purpose of insulting a foreign state, damages, removes, ' +
    'or defaces the national flag or other national emblem of said state shall be punished by ' +
    'imprisonment for not more than 2 years or a fine of not more than 200,000 yen.<br><br>' +
    '<strong>Article 92, Paragraph 2</strong><br>' +
    'The crime prescribed under the preceding paragraph shall not be prosecuted ' +
    'without a request from the government of the foreign state.',
  shareText: 'I tried to generate a flag but it got destroyed.',
  shareTextCountry: (c) => `I generated a ${c}-ish flag and it got destroyed. Penal Code Art. 92 violated.`,
  shareTextJapan: "I generated the Japanese flag and it got destroyed. Goodbye everyone.",
  infoFormat: (shape, bg, sc) => `${shape} | bg: ${bg} | emblem: ${sc}`,
  webglError: 'WebGL not supported',
  shapes: { '円': 'Circle', '星': 'Star', '三日月': 'Crescent', '十字': 'Cross' },
  colors: { '白': 'White', '赤': 'Red', '青': 'Blue', '緑': 'Green', '黄': 'Yellow', '黒': 'Black' },
  effects: { explosion: 'Explosion', burn: 'Combustion' },
};

// Detect browser language
function detectLang() {
  const langs = navigator.languages || [navigator.language || 'ja'];
  for (const lang of langs) {
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('ja')) return 'ja';
  }
  return 'ja';
}

const lang = detectLang();
const t = lang === 'en' ? en : ja;

export { t, lang };
