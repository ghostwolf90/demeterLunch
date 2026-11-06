import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const copy = readFileSync(new URL('../web/locales/en.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../web/i18n.js', import.meta.url), 'utf8');

function load({ saved = null, languages = ['en-US'], blocked = false, dom = false } = {}) {
  const storage = new Map(saved === null ? [] : [['demeter-language', saved]]);
  const handlers = {};
  const context = {
    navigator: { languages, language: languages[0] },
    localStorage: {
      getItem(key) { if (blocked) throw Error('blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('blocked'); storage.set(key, value); },
      removeItem(key) { if (blocked) throw Error('blocked'); storage.delete(key); },
    },
    addEventListener(name, callback) { handlers[name] = callback; },
    dispatchEvent() {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  };
  let deliver;
  if (dom) {
    context.document = {
      documentElement: element(),
      querySelectorAll() { return []; },
      addEventListener() {},
    };
    context.MutationObserver = class { constructor(callback) { deliver = callback; } observe() {} };
  }
  context.window = context;
  vm.createContext(context);
  vm.runInContext(copy, context);
  vm.runInContext(runtime, context);
  return { api: context.LunchI18n, context, storage, handlers, deliver: records => deliver(records) };
}
function element(text = '') {
  const attributes = new Map();
  const node = {
    nodeType: 1, childNodes: [],
    closest(selector) { return selector.includes('[translate="no"]') && attributes.get('translate') === 'no' ? node : null; },
    hasAttribute: key => attributes.has(key),
    getAttribute: key => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
  };
  if (text) node.childNodes.push({ nodeType: 3, parentElement: node, nodeValue: text });
  return node;
}

test('explicit supported preference wins; browser language order is respected; unsupported languages fall back to Traditional Chinese', () => {
  const { api } = load();
  assert.equal(api.resolve('zh-Hant', ['en-US']), 'zh-Hant');
  assert.equal(api.resolve('en', ['zh-TW']), 'en');
  assert.equal(api.resolve(null, ['ja-JP', 'en-GB', 'zh-TW']), 'en');
  assert.equal(api.resolve(null, ['zh-TW', 'en-US']), 'zh-Hant');
  assert.equal(api.resolve(null, ['fr-FR', 'ja-JP']), 'zh-Hant');
  assert.equal(api.resolve('invalid', ['en-AU']), 'en');
  assert.equal(api.resolve(null, []), 'zh-Hant');
  assert.equal(load({ blocked: true }).api.language, 'en');
});

test('English covers dynamic notices without changing embedded personal or official source text', () => {
  const { api } = load();
  assert.equal(api.t('設定'), 'Settings');
  assert.equal(api.t('  顯示偏好\n'), '  Display preferences\n');
  assert.equal(api.t('查看全部 12 筆飲食紀錄'), 'View all 12 journal entries');
  assert.equal(api.t('孩子說：「我今天不喜歡蛋」'), 'Your child\'s words: “我今天不喜歡蛋”');
  assert.equal(api.t('來源菜色：番茄炒蛋'), 'Source dish: 番茄炒蛋');
  assert.equal(api.t('編輯喜歡的設定'), 'Edit settings for 喜歡');
  assert.equal(api.t('2026年10月24日 星期六'), 'October 24, 2026 (Sat)');
  assert.equal(api.t('素食，3 道官方公開菜色'), 'Vegetarian, 3 officially listed dishes');
  assert.equal(api.t('菜色分組'), 'Dish grouping');
  assert.equal(api.t('依官方菜名標示分組，非素食認證。'), 'Grouped by official dish labels; this is not a vegetarian certification.');
});

test('English localizes Lunch Town dialogue and City Hall after-hours routines', () => {
  const { api } = load();
  assert.equal(api.t('小晴'), 'Sunny');
  assert.equal(api.t('大安區・學生'), 'Daan District · Student');
  assert.equal(api.t('按 Enter 與 小晴（學生）對話'), 'Press Enter to talk to Sunny (Student)');
  assert.equal(api.t('小晴（學生）開始對話。'), 'Conversation started with Sunny (Student).');
  assert.equal(
    api.t('海風吹來的時候，我們會聊聊海岸生態，也記得不把沙灘上的東西帶回家。'),
    'When the sea breeze blows, we talk about coastal ecology and remember not to take things home from the beach.',
  );
  assert.equal(
    api.t('我每天先看看午餐有什麼，再決定最想先認識哪一道菜。'),
    "I check what's for lunch first, then decide which dish I want to get to know first.",
  );
  assert.equal(
    api.t('已回到市政晴庭公寓，今晚不再返回市府辦公區'),
    'Back at Civic Sunny Court Apartments for the night, with no return to the civic offices.',
  );
  assert.equal(
    api.t('下班後到福星小站買晚餐、日用品或逛逛，再回家休息'),
    'Stopping by Lucky Star Stop after work for dinner, daily essentials, or a little shopping before heading home.',
  );
  assert.equal(api.t('苗栗縣'), 'Miaoli County');
  assert.equal(api.t('彰化縣'), 'Changhua County');
  assert.equal(api.t('三義鄉'), 'Sanyi Township');
  assert.equal(api.t('田尾鄉'), 'Tianwei Township');
  assert.equal(api.t('苗栗客家圓樓'), 'Miaoli Hakka Round House');
  assert.equal(api.t('臺灣客家文化館'), 'Taiwan Hakka Culture Development Center');
  assert.equal(api.t('八卦山大佛'), 'Bagua Mountain Great Buddha');
  assert.equal(api.t('芳苑濕地'), 'Fangyuan Wetlands');
  assert.equal(api.t('苗栗縣政府'), 'Miaoli County Government');
  assert.equal(api.t('彰化縣議會'), 'Changhua County Council');
  assert.equal(api.t('苗栗市公所'), 'Miaoli City local office');
  assert.equal(api.t('按 Enter 進入 苗栗縣政府'), 'Press Enter to enter Miaoli County Government');
  assert.equal(api.t('苗栗市・果農 2'), 'Miaoli City · Fruit grower 2');
  assert.equal(api.t('鍾東錦'), 'Chung Tung-chin');
  assert.equal(api.t('王惠美'), 'Wang Hui-mei');
  assert.equal(api.t('女性角色'), 'Women characters');
  assert.equal(api.t('向野'), 'Xiangye');
  assert.equal(api.t('岳陽造型，俐落黑髮、藍灰運動裝與水壺'), 'Yueyang style with neat black hair, blue-gray activewear, and a water bottle');
  assert.equal(api.t('玩家已切換為海音造型。'), 'Player switched to the Haiyin style.');
  assert.equal(api.t('時間與音樂'), 'Time and music');
  assert.equal(api.t('小鎮已隔離一個異常畫面項目，人物可以繼續移動。'), 'Lunch Town isolated a faulty visual item so everyone can keep moving.');
  assert.equal(api.t('我的家'), 'My Home');
  assert.equal(api.t('陽光庭院之家'), 'Sunny Garden Home');
  assert.equal(api.t('選擇造型'), 'Choose a look');
  assert.equal(api.t('目前人物造型全身預覽'), 'Full-body preview of the current avatar');
  assert.equal(api.t('海音全身造型預覽'), 'Full-body preview of Haiyin');
  assert.equal(api.t('短黑髮・皮衣・咖啡'), 'Short black hair · Leather jacket · Coffee');
  assert.equal(api.t('人物表情特寫'), 'Character expression close-up');
  assert.equal(api.t('表情'), 'Expression');
  assert.equal(api.t('開心'), 'Happy');
  assert.equal(api.t('溫和'), 'Gentle');
  assert.equal(api.t('專注'), 'Focused');
  assert.equal(api.t('自信'), 'Confident');
  assert.equal(api.t('思考'), 'Thoughtful');
  assert.equal(api.t('驚訝'), 'Surprised');
  assert.equal(api.t('平靜'), 'Calm');
  assert.equal(api.t('苗栗縣政生活公寓 A棟'), 'Miaoli Civic Residence · Building A');
  assert.equal(
    api.t('縣府已下班，正在回到苗栗縣政生活公寓 A棟｜2樓1室休息'),
    'The County Government is closed for the day. Heading back to Miaoli Civic Residence · Building A · Floor 2, Unit 1 to rest.',
  );
  assert.equal(
    api.t('下班後到彰化縣政生活店買晚餐與日用品，再回住家休息'),
    'Stopping by Changhua Civic Market after work for dinner and daily essentials before heading home.',
  );
  assert.equal(api.t('臺中・苗栗・彰化午餐小鎮'), 'Taichung · Miaoli · Changhua Lunch Town');
  assert.equal(api.t('各校當日午餐可查詢'), "Check today's lunch for any school");
  assert.equal(api.t('學校午餐查詢'), 'School lunch lookup');
  assert.equal(api.t('歡迎來到苗栗縣'), 'Welcome to Miaoli County');
  assert.equal(api.t('歡迎來到彰化縣'), 'Welcome to Changhua County');
  assert.equal(api.t('午餐資料持續更新'), 'Lunch data update in progress');
  assert.equal(api.t('當日午餐已更新'), "Today's lunch data is ready");
  assert.equal(api.t('回家報到'), 'Check in at home');
  assert.equal(api.t('每日任務完成'), 'Daily quest complete');
  assert.equal(api.t('今日已完成 2 / 3 題，金幣餘額 45。'), 'Completed 2 / 3 today · 45 coins available.');
  assert.equal(api.t('已選擇番茄炒蛋作為今天感興趣的菜色。'), "Selected 番茄炒蛋 as today's interesting dish.");
  assert.equal(api.t('朵朵家的任務與成就'), "朵朵家's quests and achievements");
  assert.equal(api.t('苗栗縣地圖工區'), 'Miaoli County map work zone');
  assert.equal(api.t('彰化縣地圖工區'), 'Changhua County map work zone');
  assert.equal(api.t('釣魚平台'), 'Fishing deck');
  assert.equal(api.t('指定休憩區'), 'Designated recreation area');
  assert.equal(
    api.t('在北界河濱釣魚平台的安全平台釣魚，釣線朝向河道但人留在護欄內'),
    'Fishing from the safe deck at North river fishing deck, with the line over the river and the person behind the railing.',
  );
  assert.equal(
    api.t('在南界河岸休憩區使用指定烤肉台休憩，並把垃圾與火源收拾好'),
    'Relaxing at the designated grill at South river recreation area, with litter cleared and the fire safely put out afterward.',
  );
  assert.equal(
    api.t('到鄰近縣市施工區散步，看看地圖未來會往哪裡延伸'),
    'Taking a walk through a neighboring county work zone to see where the map may grow next',
  );
  assert.equal(
    api.t('到三義鄉散步，看看當地學校與景觀'),
    'Walking through Sanyi Township to see its schools and local scenery.',
  );
  assert.equal(
    api.t('114 所國小已放入地圖｜各校當日午餐開放查詢'),
    "114 elementary schools mapped · Today's lunch lookup is available for every school",
  );
  assert.equal(
    api.t('114 所國小已放入地圖｜今日 27 校已有午餐資料'),
    "114 elementary schools mapped · 27 have today's lunch data",
  );
  assert.equal(
    api.t('今日 3/8 校有午餐資料'),
    "Today's lunch data is available for 3/8 schools",
  );
  assert.equal(
    api.t('查看田尾鄉特色的官方參考來源'),
    'View the official reference for local features in Tianwei Township',
  );
});

test('English localizes Changhua jobs, work zones, and four-period routines', () => {
  const { api } = load();
  assert.equal(api.t('稻農'), 'Rice farmer');
  assert.equal(api.t('農業技術員'), 'Agricultural technician');
  assert.equal(api.t('糖廠小火車人員'), 'Sugar railway worker');
  assert.equal(api.t('彰化縣政府農業處'), 'Changhua County Department of Agriculture');
  assert.equal(api.t('芳苑潮間帶蚵田與海牛車路線'), 'Fangyuan Intertidal Oyster Beds and Ox-Cart Route');
  assert.equal(api.t('田尾花田自行車道與電照菊'), 'Tianwei Flower Bike Route and Lit Chrysanthemums');
  assert.equal(
    api.t('在和美水田與田埂進行水田巡查、放水與田埂整理'),
    'Working at Hemei Paddies and Field Ridges: paddy inspection, water release, and ridge maintenance',
  );
  assert.equal(
    api.t('在溪州堤防、水圳與抽水站巡查水圳、閘門與抽水設施'),
    'Inspecting channels, gates, and pumping equipment at Xizhou Levee, Irrigation Channels, and Pump Station',
  );
  assert.equal(api.t('深夜回到田尾鄉住家休息'), 'Returning home in Tianwei Township for the night');
  assert.equal(api.t('彰化縣跨縣橋入口'), 'Changhua County county-bridge entrance');
});

test('English fully localizes adaptive civic-agent status, memory, and route reasons', () => {
  const { api } = load();
  assert.equal(api.t('何欣純'), 'Ho Hsin-chun');
  assert.equal(api.t('智慧角色'), 'Adaptive role');
  assert.equal(
    api.t('我目前在彰化市，正在觀察縣市服務與街區狀況。'),
    'I am currently at Changhua City, reviewing local services and neighborhood conditions.',
  );
  assert.equal(
    api.t('我記得先前在苗栗市完成過轄區安全巡查；這次會接著已記錄的進度處理。'),
    'I remember completing assigned-area safety patrol in Miaoli City; I will continue from that recorded progress.',
  );
  assert.equal(
    api.t('到八卦山大佛走訪並確認現場狀況'),
    'Visiting Bagua Mountain Great Buddha to check conditions on site',
  );
  assert.equal(
    api.t('前往彰化市事件現場，依通報確認方向與安全動線'),
    'Heading to the incident in Changhua City to verify the reported direction and safe access route',
  );
  for (const text of [
    api.t('我目前在彰化市，正在觀察縣市服務與街區狀況。'),
    api.t('我記得先前在苗栗市完成過轄區安全巡查；這次會接著已記錄的進度處理。'),
    api.t('前往彰化市事件現場，依通報確認方向與安全動線'),
  ]) assert.doesNotMatch(text, /[\u3400-\u9fff]/u);
});

test('language changes restore Chinese, preserve raw source text and form values, and handle later renders', () => {
  const env = load({ dom: true });
  const heading = element('設定');
  const source = env.api.keep(element('蛋'));
  const field = element(); field.value = '孩子填寫的內容';
  env.context.document.documentElement.childNodes.push(heading, source, field);
  env.api.translateTree(heading); env.api.translateTree(source);
  assert.equal(heading.childNodes[0].nodeValue, 'Settings');
  assert.equal(source.childNodes[0].nodeValue, '蛋');
  env.api.select('zh-Hant');
  assert.equal(heading.childNodes[0].nodeValue, '設定');
  assert.equal(field.value, '孩子填寫的內容');
  assert.equal(env.storage.get('demeter-language'), 'zh-Hant');
  env.api.select('auto');
  assert.equal(env.api.language, 'en');
  assert.equal(env.storage.has('demeter-language'), false);
  heading.childNodes[0].nodeValue = '正在儲存…';
  env.deliver([{ type: 'characterData', target: heading.childNodes[0] }]);
  assert.equal(heading.childNodes[0].nodeValue, 'Saving…');
  env.api.select('zh-Hant');
  assert.equal(heading.childNodes[0].nodeValue, '正在儲存…');
  assert.deepEqual([...env.storage.keys()], ['demeter-language']);
});

test('blocked storage and browser-language changes do not break switching', () => {
  const { api, context, handlers } = load({ dom: true, blocked: true });
  api.select('zh-Hant');
  assert.equal(api.language, 'zh-Hant');
  context.navigator.languages = ['en-US'];
  handlers.languagechange();
  assert.equal(api.language, 'zh-Hant');
  api.select('auto');
  assert.equal(api.language, 'en');
  context.navigator.languages = ['ja-JP'];
  handlers.languagechange();
  assert.equal(api.language, 'zh-Hant');
});
