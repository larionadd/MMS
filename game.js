const SAVE_KEY = "medievalMerchantSaveV029";
const LEGACY_SAVE_KEYS = [];
const CARAVAN_ENABLED = false;
const CAMPAIGN_YEAR = 1205;

// === v0.43: CrazyGames SDK wrapper ===========================================
// Safe no-op when the SDK isn't present (itch.io, GitHub Pages, local file://).
// On CrazyGames the SDK becomes available shortly after page load — we wait
// for it and then enable the real implementation. Outside of CG every call
// silently resolves so nothing breaks.
const CG = (function(){
  const state = {
    sdk: null,
    initialized: false,
    initStarted: false,
    isCrazyGames: false,
    lastMidgameDay: -999,
    midgameMinGap: 3,           // require ≥3 in-game days between midgame ads
    inGameplay: false
  };
  function isOnCrazyGames(){
    try{
      const host = (location && location.hostname || "").toLowerCase();
      return host.endsWith("crazygames.com") || host.endsWith("1001juegos.com");
    }catch(e){return false;}
  }
  function getSDK(){
    return (typeof window!=="undefined" && window.CrazyGames && window.CrazyGames.SDK) || null;
  }
  async function init(){
    if(state.initialized || state.initStarted) return;
    state.initStarted = true;
    state.isCrazyGames = isOnCrazyGames();
    if(window.__CG_FAIL || !state.isCrazyGames){
      // SDK script not loaded or we're not on CrazyGames → stay in stub mode.
      state.initialized = true;
      return;
    }
    // Wait up to 4 s for the async <script> to resolve window.CrazyGames.SDK
    const start = (window.performance && performance.now()) || Date.now();
    while(!getSDK()){
      const now = (window.performance && performance.now()) || Date.now();
      if(now - start > 4000){state.initialized=true;return;}
      await new Promise(r=>setTimeout(r,50));
    }
    state.sdk = getSDK();
    try{
      // SDK v3 init – tells CG we're ready to receive ad calls
      if(state.sdk.init){await state.sdk.init();}
    }catch(e){console.warn("[CG] init failed:",e);}
    state.initialized = true;
  }
  function loadingStart(){if(state.sdk && state.sdk.game && state.sdk.game.loadingStart) try{state.sdk.game.loadingStart();}catch(e){}}
  function loadingStop(){if(state.sdk && state.sdk.game && state.sdk.game.loadingStop) try{state.sdk.game.loadingStop();}catch(e){}}
  function gameplayStart(){
    if(state.inGameplay) return;
    state.inGameplay = true;
    if(state.sdk && state.sdk.game && state.sdk.game.gameplayStart) try{state.sdk.game.gameplayStart();}catch(e){}
  }
  function gameplayStop(){
    if(!state.inGameplay) return;
    state.inGameplay = false;
    if(state.sdk && state.sdk.game && state.sdk.game.gameplayStop) try{state.sdk.game.gameplayStop();}catch(e){}
  }
  function happytime(){if(state.sdk && state.sdk.game && state.sdk.game.happytime) try{state.sdk.game.happytime();}catch(e){}}
  // Midgame ad with frequency cap (no more than once per N in-game days).
  // Returns a promise that resolves after the ad finishes OR if there is no SDK.
  function maybeMidgameAd(currentDay){
    return new Promise(resolve=>{
      if(!state.sdk || !state.sdk.ad || !state.sdk.ad.requestAd){resolve(false);return;}
      if(typeof currentDay==="number" && currentDay - state.lastMidgameDay < state.midgameMinGap){resolve(false);return;}
      let finished=false;
      const finish=ok=>{if(finished) return;finished=true;resolve(ok);};
      try{
        gameplayStop();
        state.sdk.ad.requestAd("midgame",{
          adStarted:()=>{},
          adFinished:()=>{
            if(typeof currentDay==="number") state.lastMidgameDay = currentDay;
            gameplayStart();
            finish(true);
          },
          adError:err=>{console.warn("[CG] midgame ad error:",err);gameplayStart();finish(false);}
        });
        // Safety timeout in case the SDK never calls the callback
        setTimeout(()=>{if(!finished){gameplayStart();finish(false);}},20000);
      }catch(e){console.warn("[CG] midgame ad threw:",e);gameplayStart();finish(false);}
    });
  }
  // Rewarded ad — caller decides what reward to give on success.
  function rewardedAd(){
    return new Promise(resolve=>{
      if(!state.sdk || !state.sdk.ad || !state.sdk.ad.requestAd){resolve(false);return;}
      let finished=false;
      const finish=ok=>{if(finished) return;finished=true;resolve(ok);};
      try{
        gameplayStop();
        state.sdk.ad.requestAd("rewarded",{
          adStarted:()=>{},
          adFinished:()=>{gameplayStart();finish(true);},
          adError:err=>{console.warn("[CG] rewarded ad error:",err);gameplayStart();finish(false);}
        });
        setTimeout(()=>{if(!finished){gameplayStart();finish(false);}},30000);
      }catch(e){console.warn("[CG] rewarded ad threw:",e);gameplayStart();finish(false);}
    });
  }
  return {init,loadingStart,loadingStop,gameplayStart,gameplayStop,happytime,maybeMidgameAd,rewardedAd,
    isCrazyGames:()=>state.isCrazyGames,
    isReady:()=>state.initialized};
})();
// Kick off the SDK init as early as possible so it's ready by first gameplay.
CG.init().then(()=>{
  // Show the "Bonuses" button only on CrazyGames once the SDK is confirmed
  if(typeof showAdRewardButtonIfNeeded==="function") showAdRewardButtonIfNeeded();
});
// ============================================================================

const BALANCE = Object.freeze({
  actionsPerDay:7,
  startingGold:1000,
  headquartersCost:250,
  maxAttribute:20,
  oldAgeStart:63,
  immortalAge:90,
  legendaryTravelChance:0.008,
  minimumCaravanRisk:0.04,
  oldAgeMortality:Object.freeze({69:0.04,79:0.09,89:0.22,90:0.35}),
  supplyPriceMultiplier:0.74,
  demandPriceMultiplier:1.28,
  baseSaleMultiplier:0.82,
  journalLimit:180,
  historyLimit:80,
  startingFood:20,
  slaveFoodPerDay:1,
  maxHouseRooms:20,
  shopStockSize:5,
  shopStockDays:7,
  unpaidDismissDays:3,
  slaveDeathWithoutFoodDays:7,
  bulkDiscount:0.25,
  marketReversion:0.25,
  marketElasticity:0.25,
  marketElasticityMin:0.62,
  marketElasticityMax:1.7,
  marketShockChance:0.12,
  marketShockDaysMin:2,
  marketShockDaysMax:4,
  naturalStock:Object.freeze({supply:28,demand:20,neutral:24})
});
const MAX_DAILY_ACTIONS = BALANCE.actionsPerDay;

/* ============================ Локалізація / Localization ============================ */
const LANG_KEY = "medievalMerchantLang";
let lang = "uk";
function loadLang(){ try{ const v=localStorage.getItem(LANG_KEY); if(v==="uk"||v==="en") lang=v; }catch(e){} }
function setLang(value){ if(value!=="uk"&&value!=="en") return; lang=value; try{localStorage.setItem(LANG_KEY,lang);}catch(e){} applyStaticI18n(); if(typeof render==="function") render(); }
function toggleLang(){ setLang(lang==="uk"?"en":"uk"); }

// Статичні рядки інтерфейсу. Ключі стабільні, значення — для кожної мови.
const STRINGS = {
  uk:{
    "ui.lang_toggle":"English",
    "nav.market":"Ринок","nav.square":"Площа","nav.travel":"Подорожі","nav.player":"Герой","nav.guild":"Гільдія",
    "square.title":"🏛️ Головна площа","square.guild":"Гільдія","square.shop":"Крамниця","square.people":"Центр зайнятості","square.slaves":"Ринок рабів",
    "slaves.title":"⛓️ Ринок рабів","slaves.desc":"Можна купити підневільних людей. Доступні лише мешканці поточного міста.",
    "nav.people":"Центр зайнятості","nav.subordinates":"Підлеглі","nav.shop":"Крамниця",
    "nav.caravan":"Караван","nav.hq":"Штаб","nav.journal":"Журнал","nav.help":"Довідка","nav.achievements":"Досягнення",
    "btn.next_day":"⏭️ Наступний день","btn.next_week":"⏩ Наступний тиждень","btn.save":"Зберегти","btn.new_game":"Нова гра",
    "btn.menu":"☰ Меню","btn.continue":"Продовжити","btn.close":"Закрити","btn.skip":"⏩ Пропустити","btn.finish_travel":"✓ Завершити подорож","btn.cancel_travel":"✕ Скасувати подорож",
    "btn.start_journey":"Почати шлях","btn.travel_peacefully":"Вирушити мирно","btn.raid_caravan":"Напасти на зустрічний караван",
    "label.active_quests":"Активні завдання","label.action_log":"Журнал дій",
    "status.year":"рік","status.day":"День","status.level":"Рівень","status.actions":"дій",
    "market.title":"💰 Ринок міста","market.you_are_in":"Ти перебуваєш у місті","market.warehouse":"📦 Твій склад","market.goods":"📦 Товари",
    "travel.title":"🧭 Подорожі між містами","player.title":"🧭 Герой",
    "guild.title":"📜 Гільдія торговців","guild.contracts":"Торгові контракти гільдії","guild.council":"Мерія міста","guild.accepted":"Прийняті замовлення",
    "people.title":"👥 Центр зайнятості","people.desc":"Тут гравець може найняти нових працівників та купити підневільних людей. Доступні лише люди міста, в якому ти перебуваєш; вирушай в інші міста, щоб знайти інших кандидатів.",
    "sub.title":"🛡️ Підлеглі торгового дому","sub.workers":"Працівники та громадяни","sub.slaves":"Підневільні люди",
    "shop.title":"🎁 Крамниця речей","shop.desc":"Придбані речі зберігаються у запасі. Вручити їх конкретному персонажу можна в його особовій справі.","shop.quality_note":"Якість речей: звичайна, покращена, рідкісна, виняткова, легендарна. Легендарні реліквії не продаються: їх можна випадково знайти під час подорожі.","shop.workers":"Для працівників і громадян","shop.workers_desc":"Подарунки, одяг і талісмани, які підвищують комфорт та відданість.","shop.bonded":"Забезпечення підневільних людей","shop.bonded_desc":"Теплі та корисні речі для покращення здоров'я і лояльності.","shop.home":"Для дому та штаб-квартири","shop.home_desc":"Меблі й обладнання можна встановлювати лише у доречних приміщеннях штабу. Звичайні та рідкісні речі продаються, легендарні потрібно знайти.","shop.my_items":"Мої придбані речі","shop.home_items":"Меблі та обладнання в запасі",
    "caravan.title":"🐎 Караван","caravan.desc":"Відправляй власні товари маршрутом. Оплата приходить після прибуття, а ризик може знищити частину вантажу.",
    "hq.title":"🏰 Штаб-квартира","journal.title":"📜 Журнал","journal.search":"Пошук у журналі подій...",
    "ach.title":"🏆 Досягнення торгового дому","ach.desc":"Досягнення відкриваються за рівні героя, шлюб, дітей, легендарні речі, міста та розвиток штабу.","help.title":"❔ Довідка для нового гравця",
    "modal.day_summary":"Підсумок дня","modal.start_new_day":"Почати новий день","modal.event":"Подія дня","modal.meeting":"Зустріч","modal.hidden_place":"Приховане місце","modal.relationships":"Стосунки","modal.combat":"Бій",
    "travel.day_zero":"День 0","travel.prepare":"Підготовка подорожі","travel.auto_battle":"Автоматичний бій","travel.manual_battle":"Ручний режим бою",
    "creation.title":"Початок шляху: 1205 рік","creation.intro":"Європейські шляхи з'єднують князівства, королівства, міські комуни й порти. Після потрясінь попереднього століття торговці дедалі частіше вирішують долю міст: від солі та зерна до зброї й шовку. Ти починаєш без майна і штабу, маючи лише 1000 монет та власне ім'я.","creation.origin":"Обери походження","creation.name_label":"Власне ім'я або ім'я обраного героя","creation.name_placeholder":"Введи ім'я героя","creation.city":"Стартове місто","creation.difficulty":"Рівень складності","creation.note":"Штаб ще не заснований. У вибраному місті можна залишитись або поїхати в інше та створити штаб там.",
    "welcome.subtitle":"Choose your language / Обери мову",
    "saves.slot_placeholder":"Назва слота (наприклад: «Перед битвою»)",
    "title.expand":"Розгорнути","title.close":"Закрити",
    "trade.buy1":"Купити 1","trade.buy5":"Купити до 5","trade.sell1":"Продати 1","trade.sell_all":"Продати все",
    "badge.stock":"Запас","badge.buy":"Купити","badge.bulk":"Опт 5+","badge.sell":"Продати","badge.have":"Маєш",
    "trend.shortage":"📈 Дефіцит","trend.glut":"📉 Надлишок","trend.expensive":"📈 Дорого","trend.cheap":"📉 Дешево",
    "btn.slots":"💾 Слоти","btn.rewards":"🎁 Бонуси",
    "rewards.title":"Бонуси за рекламу","rewards.desc":"Подивись коротку рекламу — отримай корисний бонус. Доступно до 3 нагород на день.",
    "square.townhall":"Мерія","square.tavern":"Таверна",
    "townhall.title":"🏛️ Мерія міста","townhall.orders":"Доручення міської ради","townhall.accepted":"Прийняті доручення мерії",
    "guild.accepted_guild":"Прийняті замовлення гільдії",
    "tavern.title":"🍻 Міська таверна","tavern.desc":"Гамірне світло свічок, запах смаженого м'яса, дзвін кухлів. Тут торговці відпочивають, слухають чужі історії — і часом ризикують усім.",
    "dice.title":"🎲 Гра в кості","lock.pay":"Сплатити штраф 1000 монет",
    "saves.title":"Збереження","saves.desc":"Зберігай і завантажуй гру в окремих слотах. Автозбереження у головному ключі лишається активним.","saves.save_btn":"Зберегти поточну гру","saves.list":"Збережені слоти"
  },
  en:{
    "ui.lang_toggle":"Українська",
    "nav.market":"Market","nav.square":"Square","nav.travel":"Travel","nav.player":"Hero","nav.guild":"Guild",
    "square.title":"🏛️ Main Square","square.guild":"Guild","square.shop":"Shop","square.people":"Employment","square.slaves":"Slave market",
    "slaves.title":"⛓️ Slave market","slaves.desc":"Buy bonded people. Only candidates from the current city are available.",
    "nav.people":"Employment","nav.subordinates":"Retinue","nav.shop":"Shop",
    "nav.caravan":"Caravan","nav.hq":"Headquarters","nav.journal":"Journal","nav.help":"Help","nav.achievements":"Achievements",
    "btn.next_day":"⏭️ Next day","btn.next_week":"⏩ Next week","btn.save":"Save","btn.new_game":"New game",
    "btn.menu":"☰ Menu","btn.continue":"Continue","btn.close":"Close","btn.skip":"⏩ Skip","btn.finish_travel":"✓ Finish travel","btn.cancel_travel":"✕ Cancel travel",
    "btn.start_journey":"Start journey","btn.travel_peacefully":"Travel peacefully","btn.raid_caravan":"Attack passing caravan",
    "label.active_quests":"Active quests","label.action_log":"Action log",
    "status.year":"AD","status.day":"Day","status.level":"Level","status.actions":"actions",
    "market.title":"💰 City market","market.you_are_in":"You are in the city of","market.warehouse":"📦 Your warehouse","market.goods":"📦 Goods",
    "travel.title":"🧭 Travel between cities","player.title":"🧭 Hero",
    "guild.title":"📜 Merchants' guild","guild.contracts":"Guild trade contracts","guild.council":"City council","guild.accepted":"Accepted orders",
    "people.title":"👥 Employment centre","people.desc":"Here you can hire new workers and buy bonded people. Only people of the city you are currently in are available; travel to other cities to find other candidates.",
    "sub.title":"🛡️ Retinue of the trading house","sub.workers":"Workers and citizens","sub.slaves":"Bonded people",
    "shop.title":"🎁 Goods shop","shop.desc":"Purchased items are kept in storage. You can give them to a specific character from their personal file.","shop.quality_note":"Item quality: common, improved, rare, exceptional, legendary. Legendary relics are not sold: they can be found by chance during travel.","shop.workers":"For workers and citizens","shop.workers_desc":"Gifts, clothes, and talismans that improve comfort and loyalty.","shop.bonded":"Supplies for bonded people","shop.bonded_desc":"Warm and useful items that improve health and loyalty.","shop.home":"For home and headquarters","shop.home_desc":"Furniture and equipment can only be installed in suitable headquarters rooms. Common and rare items are sold; legendary ones must be found.","shop.my_items":"My purchased items","shop.home_items":"Furniture and equipment in storage",
    "caravan.title":"🐎 Caravan","caravan.desc":"Send your own goods along a route. Payment arrives after delivery, while risk may destroy part of the cargo.",
    "hq.title":"🏰 Headquarters","journal.title":"📜 Journal","journal.search":"Search the event journal...",
    "ach.title":"🏆 Achievements of the trading house","ach.desc":"Achievements unlock for hero levels, marriage, children, legendary items, cities, and headquarters development.","help.title":"❔ Help for new players",
    "modal.day_summary":"Day summary","modal.start_new_day":"Start a new day","modal.event":"Day event","modal.meeting":"Meeting","modal.hidden_place":"Hidden place","modal.relationships":"Relationships","modal.combat":"Combat",
    "travel.day_zero":"Day 0","travel.prepare":"Travel preparation","travel.auto_battle":"Automatic combat","travel.manual_battle":"Manual combat mode",
    "creation.title":"The road begins: 1205 AD","creation.intro":"European roads connect principalities, kingdoms, city communes, and ports. After the shocks of the previous century, merchants increasingly decide the fate of cities: from salt and grain to weapons and silk. You begin with no property and no headquarters, carrying only 1000 coins and your own name.","creation.origin":"Choose origin","creation.name_label":"Custom name or selected hero name","creation.name_placeholder":"Enter hero name","creation.city":"Starting city","creation.difficulty":"Difficulty level","creation.note":"Your headquarters has not been founded yet. You may stay in the chosen city or travel elsewhere and establish it there.",
    "welcome.subtitle":"Choose your language",
    "saves.slot_placeholder":"Slot name (for example: “Before battle”)",
    "title.expand":"Expand","title.close":"Close",
    "trade.buy1":"Buy 1","trade.buy5":"Buy up to 5","trade.sell1":"Sell 1","trade.sell_all":"Sell all",
    "badge.stock":"Stock","badge.buy":"Buy","badge.bulk":"Bulk 5+","badge.sell":"Sell","badge.have":"Have",
    "trend.shortage":"📈 Shortage","trend.glut":"📉 Surplus","trend.expensive":"📈 Pricey","trend.cheap":"📉 Cheap",
    "btn.slots":"💾 Slots","btn.rewards":"🎁 Bonuses",
    "rewards.title":"Ad rewards","rewards.desc":"Watch a short ad to get a useful bonus. Up to 3 rewards per day.",
    "square.townhall":"Town hall","square.tavern":"Tavern",
    "townhall.title":"🏛️ City town hall","townhall.orders":"City council orders","townhall.accepted":"Accepted council orders",
    "guild.accepted_guild":"Accepted guild orders",
    "tavern.title":"🍻 City tavern","tavern.desc":"Candle-light flickers, the smell of roast meat, the clink of tankards. Here merchants rest, listen to other folk's tales — and sometimes risk it all.",
    "dice.title":"🎲 Dice game","lock.pay":"Pay fine of 1000 coins",
    "saves.title":"Save slots","saves.desc":"Save and load the game in named slots. Autosave to the main key remains active.","saves.save_btn":"Save current game","saves.list":"Saved slots"
  }
};
function t(key){
  const table=STRINGS[lang]||STRINGS.uk;
  if(table && table[key]!=null) return table[key];
  if(STRINGS.uk[key]!=null) return STRINGS.uk[key];
  return key;
}
function tf(key,params){
  let s=t(key);
  if(params) Object.keys(params).forEach(k=>{ s=s.split("{"+k+"}").join(params[k]); });
  return s;
}

// Мапи-іменники: ключ — канонічна українська назва (вона ж ключ логіки), значення — англійський показ.
const LOC = {
  goods:{"Сіль":"Salt","Залізо":"Iron","Зерно":"Grain","Хутро":"Fur","Шкіра":"Leather","Вовна":"Wool","Льон":"Flax","Шовк":"Silk","Прянощі":"Spices","Вино":"Wine","Скло":"Glass","Інструменти":"Tools","Зброя":"Weapons","Обладунки":"Armor","Коні":"Horses","Мед":"Honey","Віск":"Wax","Риба":"Fish","Срібло":"Silver","Килими":"Carpets","Одяг":"Clothes","Сумки":"Bags","Шапки":"Hats","Прикраси":"Jewelry","Меблі":"Furniture","Кури":"Chickens","Свині":"Pigs","Корови":"Cows","Вівці":"Sheep"},
  cities:{"Краків":"Kraków","Київ":"Kyiv","Венеція":"Venice","Прага":"Prague","Лондон":"London","Йорк":"York","Париж":"Paris","Руан":"Rouen","Брюгге":"Bruges","Гент":"Ghent","Кельн":"Cologne","Майнц":"Mainz","Регенсбург":"Regensburg","Відень":"Vienna","Зальцбург":"Salzburg","Мілан":"Milan","Генуя":"Genoa","Піза":"Pisa","Флоренція":"Florence","Рим":"Rome","Болонья":"Bologna","Константинополь":"Constantinople","Салоніки":"Thessalonica","Новгород":"Novgorod","Смоленськ":"Smolensk","Полоцьк":"Polotsk","Гамбург":"Hamburg","Бремен":"Bremen","Утрехт":"Utrecht","Барселона":"Barcelona","Толедо":"Toledo","Кордова":"Córdoba","Севілья":"Seville","Лісабон":"Lisbon"},
  regions:{"Польща":"Poland","Русь":"Rus'","Італія":"Italy","Богемія":"Bohemia","Англія":"England","Франція":"France","Нормандія":"Normandy","Фландрія":"Flanders","Священна Римська імперія":"Holy Roman Empire","Австрія":"Austria","Візантія":"Byzantium","Саксонія":"Saxony","Нідерланди":"Netherlands","Каталонія":"Catalonia","Кастилія":"Castile","Аль-Андалус":"Al-Andalus","Іберія":"Iberia"},
  statuses:{"Раб":"Slave","Кріпак":"Serf","Вільний громадянин":"Free citizen","Найманець":"Hireling","Дитина родини":"Family child","Працівник":"Worker"},
  skills:{"сила":"strength","ремесло":"craft","бій":"combat","гостинність":"hospitality","покірність":"obedience","лояльність":"loyalty"},
  jobTitles:{"Майстер-коваль":"Master smith","Коваль":"Smith","Майстер-ткач":"Master weaver","Ткач":"Weaver","Майстер-фермер":"Master farmer","Фермер":"Farmer","Майстер-ювелір":"Master jeweller","Ювелір":"Jeweller","Майстер-столяр":"Master joiner","Столяр":"Joiner","Майстер-кухар":"Master cook","Кухар":"Cook","Майстер-корчмар":"Master innkeeper","Корчмар":"Innkeeper","Майстер-комірник":"Master warehouseman","Комірник":"Warehouseman","Майстер-зброяр":"Master armourer","Охоронець":"Guard"},
  ranks:{"Вуличний торговець":"Street trader","Носій краму":"Goods porter","Ринковий перекупник":"Market reseller","Власник прилавка":"Stall owner","Міський крамар":"Town shopkeeper","Мандрівний купець":"Travelling merchant","Власник складу":"Warehouse owner","Караванний торговець":"Caravan trader","Цеховий постачальник":"Guild supplier","Шанований купець":"Respected merchant","Старшина торгового дому":"Trading house elder","Радник гільдії":"Guild councillor","Скарбник гільдії":"Guild treasurer","Голова гільдії":"Guild master","Мер торгового міста":"Mayor of a trade city"},
  quality:{"Звичайна":"Common","Покращена":"Improved","Рідкісна":"Rare","Виняткова":"Exceptional","Легендарна":"Legendary"},
  relationships:{"Ледь знайомі":"Barely acquainted","Знайомі":"Acquaintances","Доброзичливе знайомство":"Friendly acquaintance","Виникає довіра":"Growing trust","Близькі товариші":"Close companions","Особиста прихильність":"Personal affection","Сильний зв'язок":"Strong bond","Теплі стосунки":"Warm relationship","Майже родина":"Almost family","Майже подружжя":"Almost married"}
};
function loc(cat,ua){ if(lang!=="en") return ua; const m=LOC[cat]; return (m && m[ua]!=null)?m[ua]:ua; }
function goodName(n){return loc("goods",n);}
function itemName(item){return item?(lang==="en"&&item.nameEn?item.nameEn:item.name):"";}
function cityNameByName(n){return loc("cities",n);}
function cityName(i){return loc("cities",(cities[i]&&cities[i].name)||"");}
function regionName(r){return loc("regions",r);}

function applyStaticI18n(){
  if(typeof document==="undefined") return;
  if(document.documentElement) document.documentElement.lang=lang;
  const all=sel=>(document.querySelectorAll?Array.from(document.querySelectorAll(sel)):[]);
  all("[data-i18n]").forEach(el=>{el.textContent=t(el.getAttribute("data-i18n"));});
  all("[data-i18n-html]").forEach(el=>{el.innerHTML=t(el.getAttribute("data-i18n-html"));});
  all("[data-i18n-ph]").forEach(el=>{el.placeholder=t(el.getAttribute("data-i18n-ph"));});
  all("[data-i18n-title]").forEach(el=>{el.title=t(el.getAttribute("data-i18n-title"));});
  const lt=document.getElementById?document.getElementById("langToggle"):null;
  if(lt) lt.textContent=t("ui.lang_toggle");
}
/* ========================== /Локалізація ========================== */

function parseInlineArgs(source){
  const args=[];
  let current="", quote=null, escaped=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(escaped){current+=ch;escaped=false;continue;}
    if(ch==="\\"){escaped=true;continue;}
    if(quote){
      if(ch===quote){quote=null;continue;}
      current+=ch;
      continue;
    }
    if(ch==="'" || ch==='"'){quote=ch;continue;}
    if(ch===","){args.push(current.trim());current="";continue;}
    current+=ch;
  }
  if(current.trim() || source.trim()) args.push(current.trim());
  return args.map(value=>{
    if(value==="true") return true;
    if(value==="false") return false;
    if(value==="null") return null;
    if(/^[-]?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value;
  });
}
function dispatchInlineClick(event){
  const target=event.target&&event.target.closest?event.target.closest("[onclick]"):null;
  if(!target) return;
  const code=target.getAttribute("onclick")||"";
  const match=code.trim().match(/^([A-Za-z_$][\w$]*)\((.*)\);?$/);
  if(!match) return;
  const fn=window[match[1]];
  if(typeof fn!=="function") return;
  event.preventDefault();
  event.stopPropagation();
  if(event.stopImmediatePropagation) event.stopImmediatePropagation();
  fn.apply(window,parseInlineArgs(match[2]));
}
if(typeof document!=="undefined" && document.addEventListener){
  document.addEventListener("click",dispatchInlineClick,true);
}

function hasItemAnywhere(id){
  const people=(Array.isArray(ownedSlaves)?ownedSlaves:[]).concat(Array.isArray(ownedHirelings)?ownedHirelings:[]);
  return itemStock(id)>0 || people.some(person=>Object.values(person.equipment||{}).includes(id));
}
// === v0.43: Difficulty ===
const DIFFICULTY_LEVELS={
  easy:{
    key:"easy",
    name:{uk:"Легко",en:"Easy"},
    icon:"🌱",
    desc:{uk:"Для нових гравців: більше грошей, дій і м'якші покарання.",en:"For new players: more gold, actions, and gentler penalties."},
    startingGold:2500, startingFood:35, actionsBonus:2,
    travelCostMult:0.7, ambushChanceMult:0.5,
    payrollMult:0.7, foodConsumeMult:0.7,
    questRewardMult:1.3, enemyHpMult:0.7, enemyAttackMult:0.8,
    skillDriftMult:1.4, combatLossMult:0.5
  },
  normal:{
    key:"normal",
    name:{uk:"Звичайно",en:"Normal"},
    icon:"⚖️",
    desc:{uk:"Збалансований досвід — як задумано.",en:"Balanced experience — as designed."},
    startingGold:1000, startingFood:20, actionsBonus:0,
    travelCostMult:1.0, ambushChanceMult:1.0,
    payrollMult:1.0, foodConsumeMult:1.0,
    questRewardMult:1.0, enemyHpMult:1.0, enemyAttackMult:1.0,
    skillDriftMult:1.0, combatLossMult:1.0
  },
  hard:{
    key:"hard",
    name:{uk:"Складно",en:"Hard"},
    icon:"⚔️",
    desc:{uk:"Для досвідчених: жорстокий ринок, лютіші вороги.",en:"For veterans: brutal market, fiercer enemies."},
    startingGold:600, startingFood:14, actionsBonus:-1,
    travelCostMult:1.3, ambushChanceMult:1.5,
    payrollMult:1.2, foodConsumeMult:1.2,
    questRewardMult:0.85, enemyHpMult:1.25, enemyAttackMult:1.2,
    skillDriftMult:0.8, combatLossMult:1.3
  }
};
function currentDifficulty(){
  const key=player&&player.difficulty||"normal";
  return DIFFICULTY_LEVELS[key]||DIFFICULTY_LEVELS.normal;
}
function diffMult(k){return currentDifficulty()[k];}

function dailyActionLimit(){
  const bonus=currentDifficulty().actionsBonus||0;
  return Math.max(1,BALANCE.actionsPerDay+bonus)+(hasItemAnywhere("scholar_motion_talisman")?1:0);
}

// === v0.43: Save slots ===
const SAVE_SLOT_PREFIX="medievalMerchantSlot_";
function listSaveSlots(){
  const slots=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith(SAVE_SLOT_PREFIX)){
        try{
          const raw=localStorage.getItem(key);
          const data=JSON.parse(raw);
          slots.push({
            name:key.slice(SAVE_SLOT_PREFIX.length),
            key,
            day:data._meta&&data._meta.day,
            gold:data._meta&&data._meta.gold,
            playerName:data._meta&&data._meta.playerName,
            difficulty:data._meta&&data._meta.difficulty,
            savedAt:data._meta&&data._meta.savedAt,
            size:raw.length
          });
        }catch(e){}
      }
    }
  }catch(e){}
  slots.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
  return slots;
}
function writeSaveSlotWithCleanup(key,json){
  const tryWrite=()=>{
    localStorage.setItem(key,json);
    return true;
  };
  try{return tryWrite();}
  catch(firstError){
    const oldSlots=listSaveSlots()
      .filter(slot=>slot.key!==key)
      .sort((a,b)=>(a.savedAt||0)-(b.savedAt||0));
    for(const slot of oldSlots){
      try{
        localStorage.removeItem(slot.key);
        return tryWrite();
      }catch(error){}
    }
    throw firstError;
  }
}
function saveToSlot(name){
  if(!name||!name.trim()) return false;
  // v0.43+: allow apostrophes, dots, commas, parentheses — typical for slot names
  const safe=name.trim().replace(/[^a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9 _\-'’.,():!?]/g,"").slice(0,40);
  if(!safe) return false;
  try{
    const state=stateData();
    state._meta={
      day,gold,
      playerName:player&&player.name||"?",
      difficulty:player&&player.difficulty||"normal",
      savedAt:Date.now()
    };
    const json=JSON.stringify(state);
    writeSaveSlotWithCleanup(SAVE_SLOT_PREFIX+safe,json);
    log("💾 "+tr("Збережено у слот","Saved to slot")+": "+safe);
    return true;
  }catch(e){
    console.error("[saveToSlot] failed:",e);
    log("❌ "+tr("Не вдалося зберегти у слот. Браузер блокує localStorage або сховище переповнене навіть після очищення старих слотів.","Failed to save to slot. The browser blocks localStorage or storage is still full after removing old slots."));
    return false;
  }
}
function loadFromSlot(name){
  try{
    const raw=localStorage.getItem(SAVE_SLOT_PREFIX+name);
    if(!raw){
      log("❌ "+tr("Слот не знайдено: ","Slot not found: ")+name);
      return false;
    }
    // temporarily write to main key, load, then restore
    localStorage.setItem(SAVE_KEY,raw);
    const ok=loadGame();
    if(ok){
      log("📂 "+tr("Завантажено зі слоту","Loaded from slot")+": "+name);
      saveGame(false);
      render();
      return true;
    }
    log("❌ "+tr("Слот пошкоджений: ","Slot is corrupted: ")+name);
    return false;
  }catch(e){
    console.error("[loadFromSlot] failed:",e);
    log("❌ "+tr("Помилка завантаження: ","Load error: ")+(e&&e.message||"unknown"));
    return false;
  }
}
function deleteSlot(name){
  if(!window.confirm(tr("Видалити збереження «","Delete save \"")+name+tr("»?","\"?"))) return;
  localStorage.removeItem(SAVE_SLOT_PREFIX+name);
  renderSaveSlots();
}
function openSaveSlots(){
  document.getElementById("saveSlotsModal").classList.remove("hidden");
  renderSaveSlots();
}
function closeSaveSlots(){
  document.getElementById("saveSlotsModal").classList.add("hidden");
}
function renderSaveSlots(){
  const target=document.getElementById("saveSlotsList");
  if(!target) return;
  const slots=listSaveSlots();
  const fmt=ts=>{if(!ts)return"";const d=new Date(ts);return d.toLocaleDateString()+" "+d.toLocaleTimeString().slice(0,5);};
  const list=slots.length?slots.map(s=>{
    const diffIcon=DIFFICULTY_LEVELS[s.difficulty]?DIFFICULTY_LEVELS[s.difficulty].icon:"";
    // v0.43 fix: use data-slot attribute + event delegation to avoid quote-escaping bugs
    return `<div class="save-slot-row" data-slot="${encodeURIComponent(s.name)}">
      <div class="save-slot-info">
        <div class="save-slot-name"><b>${escapeHtml(s.name)}</b> ${diffIcon}</div>
        <div class="save-slot-meta">${escapeHtml(s.playerName||"")} • ${tr("День","Day")} ${s.day||"?"} • 💰 ${s.gold||"?"} • <span style="color:var(--muted)">${escapeHtml(fmt(s.savedAt))}</span></div>
      </div>
      <div class="save-slot-actions">
        <button class="btn green" data-action="load">${tr("Завантажити","Load")}</button>
        <button class="btn red" data-action="delete">${tr("Видалити","Delete")}</button>
      </div>
    </div>`;
  }).join(""):`<div class="empty">${tr("Немає збережених слотів.","No saved slots.")}</div>`;
  target.innerHTML=list;
  // Wire delegated click handler (once)
  if(!target._slotHandlerBound){
    target.addEventListener("click",ev=>{
      const btn=ev.target.closest("button[data-action]");
      if(!btn) return;
      const row=btn.closest("[data-slot]");
      if(!row) return;
      const name=decodeURIComponent(row.dataset.slot);
      const action=btn.dataset.action;
      if(action==="load"){
        if(loadFromSlot(name)) closeSaveSlots();
      }else if(action==="delete"){
        deleteSlot(name);
      }
    });
    target._slotHandlerBound=true;
  }
}
function saveCurrentToNewSlot(){
  const input=document.getElementById("saveSlotName");
  if(!input){console.warn("saveSlotName input not found");return;}
  const name=input.value.trim();
  if(!name){
    alert(tr("Введи назву слота","Enter a slot name first"));
    log("❌ "+tr("Введи назву слота","Enter a slot name"));
    return;
  }
  if(saveToSlot(name)){
    input.value="";
    renderSaveSlots();
    return;
  }
  // saveToSlot returned false
  alert(tr("Не вдалося зберегти у слот. Якщо ти в Safari/iPhone, перевір приватний режим або очисти старі слоти.","Failed to save to slot. If you are in Safari/iPhone, check private mode or remove old slots."));
  if(false){
    // dead branch to keep structure
    renderSaveSlots();
  }
}
const playerRanks = [
  {name:"Вуличний торговець",xp:0},
  {name:"Носій краму",xp:35},
  {name:"Ринковий перекупник",xp:90},
  {name:"Власник прилавка",xp:165},
  {name:"Міський крамар",xp:260},
  {name:"Мандрівний купець",xp:380},
  {name:"Власник складу",xp:525},
  {name:"Караванний торговець",xp:700},
  {name:"Цеховий постачальник",xp:910},
  {name:"Шанований купець",xp:1160},
  {name:"Старшина торгового дому",xp:1450},
  {name:"Радник гільдії",xp:1780},
  {name:"Скарбник гільдії",xp:2160},
  {name:"Голова гільдії",xp:2600},
  {name:"Мер торгового міста",xp:3120}
];
// v0.43: achievements with bilingual title/desc. Stored title/desc remain UK for save compatibility;
// accessors achievementTitle() / achievementDesc() return localized strings.
const achievementCatalog = [
  ...playerRanks.map((rank,index)=>({
    id:"level_"+(index+1),
    img:"assets/achievements/level_"+String(index+1).padStart(2,"0")+".png",
    title:"Рівень "+(index+1)+": "+rank.name,
    _rankName:rank.name,
    _level:index+1,
    desc:index===0?"Почати шлях торговця.":"Досягти нового рангу головного героя.",
    descEn:index===0?"Begin a merchant's path.":"Reach a new hero rank."
  })),
  {id:"first_marriage",img:"assets/achievements/marriage.png",title:"Сімейна угода",titleEn:"Family bond",desc:"Одружитися з NPC.",descEn:"Marry an NPC."},
  {id:"all_rooms",img:"assets/achievements/all_rooms.png",title:"Повний штаб",titleEn:"Full headquarters",desc:"Відкрити всі приміщення штабу.",descEn:"Unlock every HQ room."},
  {id:"all_cities",img:"assets/achievements/all_cities.png",title:"Уся Європа на мапі",titleEn:"All Europe on the map",desc:"Відвідати всі міста гри.",descEn:"Visit every city in the game."},
  {id:"all_legendaries",img:"assets/achievements/all_legendaries.png",title:"Збирач легенд",titleEn:"Legend collector",desc:"Отримати всі легендарні предмети.",descEn:"Obtain every legendary item."},
  {id:"first_child",img:"assets/achievements/first_child.png",title:"Нове покоління",titleEn:"New generation",desc:"Дочекатися народження дитини.",descEn:"See the birth of a child."}
];
function achievementTitle(a){
  if(a._rankName){
    return (lang==="en"?"Level ":"Рівень ")+a._level+": "+loc("ranks",a._rankName);
  }
  return lang==="en"&&a.titleEn?a.titleEn:a.title;
}
function achievementDesc(a){return lang==="en"&&a.descEn?a.descEn:a.desc;}
const heroPresets = [
  {id:"yakiv",name:"Яків Соляник",nameEn:"Yakiv Solyanyk",born:1178,birthCity:0,portrait:"yakiv",story:"Син краківського возія, який виріс серед соляних мішків і боргових розписок. Після смерті батька прагне заснувати чесний торговий дім.",storyEn:"The son of a Kraków carter, raised among salt sacks and debt ledgers. After his father's death, he wants to found an honest trading house."},
  {id:"dobromyr",name:"Добромир Вощич",nameEn:"Dobromyr Voshchych",born:1172,birthCity:1,portrait:"dobromyr",story:"Киянин із родини свічників. Знає ціну воску, хутра й слова, даного при свідках, але хоче вирватись за межі рідного торгу.",storyEn:"A Kyiv man from a family of candle-makers. He knows the value of wax, fur, and a word given before witnesses, but longs to break beyond his home market."},
  {id:"matteo",name:"Маттео Белліні",nameEn:"Matteo Bellini",born:1181,birthCity:2,portrait:"matteo",story:"Колишній писар у венеційській гавані. Навчився розрізняти справжній шовк і фальшиву обіцянку, та мріє торгувати під власною печаткою.",storyEn:"A former clerk in the Venetian harbor. He learned to tell true silk from false promises, and now dreams of trading under his own seal."},
  {id:"jan",name:"Ян Срібний",nameEn:"Jan Sribny",born:1176,birthCity:3,portrait:"jan",story:"Син празького майстра, що втратив родинну лавку через борги. Має талант до обліку та бажання повернути ім'я родини на міські брами.",storyEn:"The son of a Prague craftsman who lost the family shop to debt. He has a gift for accounts and a hunger to restore his family's name at the city gates."},
  {id:"ismael",name:"Ісмаїл аль-Куртубі",nameEn:"Ismail al-Qurtubi",born:1168,birthCity:31,portrait:"ismael",story:"Освічений мандрівник із Кордови, вихований серед книг, тканин і торгових суперечок. Його шлях веде крізь чужі міста до власної влади.",storyEn:"A learned traveler from Córdoba, raised among books, textiles, and trade disputes. His road through foreign cities leads toward power of his own."}
];
function heroPresetName(preset){return lang==="en" && preset.nameEn?preset.nameEn:preset.name;}
function heroPresetStory(preset){return lang==="en" && preset.storyEn?preset.storyEn:preset.story;}

const goodsPool = [
  {name:"Сіль",base:20},{name:"Залізо",base:42},{name:"Зерно",base:14},{name:"Хутро",base:70},
  {name:"Шкіра",base:38},{name:"Вовна",base:26},{name:"Льон",base:23},{name:"Шовк",base:185},
  {name:"Прянощі",base:230},{name:"Вино",base:78},{name:"Скло",base:105},{name:"Інструменти",base:52},
  {name:"Зброя",base:138},{name:"Обладунки",base:230},{name:"Коні",base:265},{name:"Мед",base:32},
  {name:"Віск",base:41},{name:"Риба",base:18},{name:"Срібло",base:170},{name:"Килими",base:165},
  {name:"Одяг",base:92},{name:"Сумки",base:76},{name:"Шапки",base:48},{name:"Прикраси",base:155},
  {name:"Меблі",base:118},{name:"Кури",base:12},{name:"Свині",base:44},{name:"Корови",base:120},{name:"Вівці",base:62}
];
const goodArtKeys = {
  "Сіль":"salt","Залізо":"iron","Зерно":"grain","Хутро":"fur","Шкіра":"leather","Вовна":"wool","Льон":"flax","Шовк":"silk",
  "Прянощі":"spices","Вино":"wine","Скло":"glass","Інструменти":"tools","Зброя":"weapons","Обладунки":"armor","Коні":"horses",
  "Мед":"honey","Віск":"wax","Риба":"fish","Срібло":"silver","Килими":"carpets","Одяг":"clothes","Сумки":"bags","Шапки":"hats",
  "Прикраси":"jewelry","Меблі":"furniture","Кури":"chickens","Свині":"pigs","Корови":"cows","Вівці":"sheep"
};
const goodsAtlasOrder = ["salt","iron","grain","fur","leather","wool","flax","silk","spices","wine","glass","tools","weapons","armor","horses","honey","wax","fish","silver","carpets","clothes","bags","hats","jewelry","furniture","chickens","pigs","cows","sheep"];
const achievementAtlasOrder = ["level_1","level_2","level_3","level_4","level_5","level_6","level_7","level_8","level_9","level_10","level_11","level_12","level_13","level_14","level_15","first_marriage","all_rooms","all_cities","all_legendaries","first_child"];
function atlasFrames(order,columns){
  return Object.fromEntries(order.map((id,index)=>[id,{col:index%columns,row:Math.floor(index/columns)}]));
}
const goodsAtlas = {src:"assets/goods/goods_atlas.png",columns:8,rows:4,frames:atlasFrames(goodsAtlasOrder,8)};
const achievementAtlas = {src:"assets/achievements/achievements_atlas.png",columns:5,rows:4,frames:atlasFrames(achievementAtlasOrder,5)};
function goodArtKey(name){return goodArtKeys[name]||String(name||"goods").toLowerCase().replace(/[^a-z0-9]+/g,"_");}
function goodImage(name){return "assets/goods/"+goodArtKey(name)+".png";}
function atlasSprite(atlas,key,className,label){
  const frame=atlas.frames[key];
  if(!frame) return `<span class="${className} atlas-missing">${escapeHtml(label||key)}</span>`;
  const x=atlas.columns>1?(frame.col/(atlas.columns-1))*100:0;
  const y=atlas.rows>1?(frame.row/(atlas.rows-1))*100:0;
  return `<span class="${className} atlas-sprite" title="${escapeHtml(label||key)}" style="background-image:url('${atlas.src}');background-size:${atlas.columns*100}% ${atlas.rows*100}%;background-position:${x}% ${y}%"></span>`;
}
function goodSprite(name,className){return atlasSprite(goodsAtlas,goodArtKey(name),className||"good-art-sprite",name);}
function achievementSprite(id){return atlasSprite(achievementAtlas,id,"achievement-sprite",id);}
function goodsLine(name,qty){
  return `<div class="inventory-line goods-inventory-line"><span>${goodThumb(name)}${escapeHtml(goodName(name))}</span><b>${qty} ${lang==="en"?"pcs":"шт."}</b></div>`;
}
function goodThumb(name){
  return `<span class="good-thumb">${goodSprite(name,"good-thumb-sprite")}</span>`;
}

function tradingCity(name,region,x,y,supply,demand,shopTier){
  return {name,region,x,y,supply,demand,shopTier,hint:`${name} постачає ${supply.join(", ")}; місцеві купці шукають ${demand.join(", ")}.`};
}
function cityHint(city){
  if(!city) return "";
  const supply=(city.supply||[]).map(goodName).join(", ");
  const demand=(city.demand||[]).map(goodName).join(", ");
  if(lang==="en") return `${cityNameByName(city.name)} supplies ${supply}; local merchants are looking for ${demand}.`;
  return `${city.name} постачає ${city.supply.join(", ")}; місцеві купці шукають ${city.demand.join(", ")}.`;
}
const cities = [
  tradingCity("Краків","Польща",18,15,["Сіль","Залізо","Зерно","Інструменти"],["Хутро","Вино","Шовк"],3),
  tradingCity("Київ","Русь",29,15,["Хутро","Шкіра","Віск","Мед"],["Залізо","Зброя","Вино"],3),
  tradingCity("Венеція","Італія",14,9,["Шовк","Скло","Вино","Прянощі"],["Хутро","Віск","Срібло","Килими"],4),
  tradingCity("Прага","Богемія",14,15,["Зброя","Інструменти","Срібло","Обладунки"],["Шовк","Прянощі","Килими","Вино"],3),
  tradingCity("Лондон","Англія",2,18,["Вовна","Шкіра","Зерно","Риба"],["Вино","Прянощі","Шовк"],3),
  tradingCity("Йорк","Англія",2,22,["Вовна","Шкіра","Мед","Зерно"],["Вино","Інструменти","Сіль"],2),
  tradingCity("Париж","Франція",5,15,["Вино","Зерно","Шкіра","Килими"],["Прянощі","Шовк","Срібло"],4),
  tradingCity("Руан","Нормандія",3,16,["Вовна","Риба","Шкіра","Вино"],["Сіль","Зброя","Прянощі"],2),
  tradingCity("Брюгге","Фландрія",5,18,["Вовна","Килими","Льон","Вино"],["Шовк","Прянощі","Віск"],4),
  tradingCity("Гент","Фландрія",5,17,["Вовна","Льон","Килими","Зерно"],["Вино","Скло","Срібло"],3),
  tradingCity("Кельн","Священна Римська імперія",9,17,["Вино","Інструменти","Зброя","Срібло"],["Вовна","Шовк","Прянощі"],3),
  tradingCity("Майнц","Священна Римська імперія",10,15,["Вино","Зерно","Інструменти","Віск"],["Шовк","Килими","Хутро"],2),
  tradingCity("Регенсбург","Священна Римська імперія",14,13,["Зброя","Інструменти","Сіль","Коні"],["Шовк","Вино","Прянощі"],3),
  tradingCity("Відень","Австрія",17,13,["Вино","Коні","Зерно","Зброя"],["Шовк","Прянощі","Срібло"],3),
  tradingCity("Зальцбург","Австрія",14,12,["Сіль","Залізо","Мед","Віск"],["Вино","Шовк","Килими"],2),
  tradingCity("Мілан","Італія",11,9,["Обладунки","Зброя","Шовк","Інструменти"],["Вовна","Срібло","Прянощі"],4),
  tradingCity("Генуя","Італія",9,8,["Прянощі","Шовк","Вино","Скло"],["Вовна","Зерно","Хутро"],4),
  tradingCity("Піза","Італія",10,6,["Скло","Вино","Прянощі","Риба"],["Зерно","Віск","Срібло"],3),
  tradingCity("Флоренція","Італія",11,6,["Килими","Вино","Шкіра","Срібло"],["Шовк","Прянощі","Вовна"],3),
  tradingCity("Рим","Італія",12,3,["Вино","Скло","Зерно","Килими"],["Віск","Шовк","Срібло"],4),
  tradingCity("Болонья","Італія",12,8,["Зерно","Вино","Шкіра","Інструменти"],["Шовк","Скло","Прянощі"],3),
  tradingCity("Константинополь","Візантія",27,4,["Шовк","Прянощі","Скло","Вино"],["Хутро","Віск","Срібло","Зброя"],4),
  tradingCity("Салоніки","Візантія",23,5,["Вино","Шовк","Прянощі","Зерно"],["Хутро","Віск","Зброя"],3),
  tradingCity("Новгород","Русь",28,26,["Хутро","Віск","Мед","Риба"],["Срібло","Вино","Зброя","Шовк"],3),
  tradingCity("Смоленськ","Русь",26,20,["Хутро","Віск","Льон","Мед"],["Зброя","Сіль","Вино"],2),
  tradingCity("Полоцьк","Русь",24,20,["Віск","Хутро","Льон","Риба"],["Інструменти","Срібло","Вино"],2),
  tradingCity("Гамбург","Саксонія",11,20,["Риба","Зерно","Вовна","Шкіра"],["Вино","Сіль","Прянощі"],3),
  tradingCity("Бремен","Саксонія",9,20,["Риба","Вовна","Зерно","Льон"],["Вино","Зброя","Срібло"],2),
  tradingCity("Утрехт","Нідерланди",7,18,["Вовна","Льон","Килими","Риба"],["Вино","Шовк","Прянощі"],3),
  tradingCity("Барселона","Каталонія",3,5,["Вино","Шкіра","Прянощі","Скло"],["Вовна","Віск","Зброя"],3),
  tradingCity("Толедо","Кастилія",-1,5,["Зброя","Обладунки","Шкіра","Срібло"],["Шовк","Віск","Коні"],3),
  tradingCity("Кордова","Аль-Андалус",-3,3,["Шовк","Шкіра","Прянощі","Срібло"],["Хутро","Віск","Залізо"],4),
  tradingCity("Севілья","Аль-Андалус",-4,2,["Вино","Прянощі","Шовк","Скло"],["Хутро","Вовна","Срібло"],4),
  tradingCity("Лісабон","Іберія",-7,4,["Риба","Вино","Сіль","Шкіра"],["Шовк","Зброя","Прянощі"],3)
];
const cityArtKeys = ["krakow","kyiv","venice","prague","london","york","paris","rouen","bruges","ghent","cologne","mainz","regensburg","vienna","salzburg","milan","genoa","pisa","florence","rome","bologna","constantinople","thessaloniki","novgorod","smolensk","polotsk","hamburg","bremen","utrecht","barcelona","toledo","cordoba","seville","lisbon"];
const cityProfiles = [
  ["до VII ст.","близько 10 000","Латинське християнство","князь Болеслав III Кривоустий"],
  ["V ст.","близько 50 000","Православне християнство","князівська династія Рюриковичів"],
  ["V ст.","близько 45 000","Латинське християнство","дож Венеційської республіки"],
  ["IX ст.","близько 12 000","Латинське християнство","чеська династія Пржемисловичів"],
  ["римське поселення","близько 18 000","Латинське християнство","король Англії"],
  ["римська доба","близько 8 000","Латинське християнство","король Англії"],
  ["III ст. до н.е.","близько 30 000","Латинське християнство","король Франції"],
  ["римська доба","близько 8 000","Латинське християнство","герцог Нормандії"],
  ["IX ст.","близько 10 000","Латинське християнство","граф Фландрії"],
  ["VII ст.","близько 9 000","Латинське християнство","граф Фландрії"],
  ["римська доба","близько 18 000","Латинське християнство","архієпископ Кельна"],
  ["римська доба","близько 10 000","Латинське християнство","архієпископ Майнца"],
  ["римська доба","близько 12 000","Латинське християнство","бургграф і імперська влада"],
  ["римська доба","близько 10 000","Латинське християнство","маркграф Австрії"],
  ["VIII ст.","близько 6 000","Латинське християнство","архієпископ Зальцбурга"],
  ["кельтсько-римська доба","близько 35 000","Латинське християнство","міська комуна"],
  ["давня гавань","близько 20 000","Латинське християнство","міська комуна"],
  ["римська доба","близько 12 000","Латинське християнство","міська комуна"],
  ["римська доба","близько 18 000","Латинське християнство","міська комуна"],
  ["VIII ст. до н.е.","близько 35 000","Латинське християнство","папський престол"],
  ["етруська/римська доба","близько 15 000","Латинське християнство","міська комуна"],
  ["VII ст. до н.е.","понад 200 000","Православне християнство","імператор Візантії"],
  ["IV ст. до н.е.","близько 30 000","Православне християнство","імператор Візантії"],
  ["IX ст.","близько 20 000","Православне християнство","новгородське віче і князь"],
  ["IX ст.","близько 8 000","Православне християнство","князь Русі"],
  ["862 р.","близько 6 000","Православне християнство","полоцькі князі"],
  ["IX ст.","близько 8 000","Латинське християнство","герцог Саксонії"],
  ["VIII ст.","близько 7 000","Латинське християнство","архієпископ Бремена"],
  ["римська доба","близько 8 000","Латинське християнство","єпископ Утрехта"],
  ["римська доба","близько 20 000","Латинське християнство","граф Барселони"],
  ["римська доба","близько 15 000","Латинське християнство","король Кастилії"],
  ["римська доба","близько 60 000","Іслам, християнські й юдейські громади","емірська влада Аль-Андалусу"],
  ["римська доба","близько 45 000","Іслам, християнські й юдейські громади","емірська влада Аль-Андалусу"],
  ["давнє поселення","близько 15 000","Латинське християнство","граф Португалії"]
];
const cityProfilesEn = [
  ["before the 7th c.","about 10,000","Latin Christianity","Prince Boleslaw III Wrymouth"],
  ["5th c.","about 50,000","Orthodox Christianity","the Rurikid princely dynasty"],
  ["5th c.","about 45,000","Latin Christianity","the Doge of the Republic of Venice"],
  ["9th c.","about 12,000","Latin Christianity","the Czech Premyslid dynasty"],
  ["Roman settlement","about 18,000","Latin Christianity","the King of England"],
  ["Roman era","about 8,000","Latin Christianity","the King of England"],
  ["3rd c. BC","about 30,000","Latin Christianity","the King of France"],
  ["Roman era","about 8,000","Latin Christianity","the Duke of Normandy"],
  ["9th c.","about 10,000","Latin Christianity","the Count of Flanders"],
  ["7th c.","about 9,000","Latin Christianity","the Count of Flanders"],
  ["Roman era","about 18,000","Latin Christianity","the Archbishop of Cologne"],
  ["Roman era","about 10,000","Latin Christianity","the Archbishop of Mainz"],
  ["Roman era","about 12,000","Latin Christianity","the burgrave and imperial authority"],
  ["Roman era","about 10,000","Latin Christianity","the Margrave of Austria"],
  ["8th c.","about 6,000","Latin Christianity","the Archbishop of Salzburg"],
  ["Celtic-Roman era","about 35,000","Latin Christianity","the city commune"],
  ["ancient harbor","about 20,000","Latin Christianity","the city commune"],
  ["Roman era","about 12,000","Latin Christianity","the city commune"],
  ["Roman era","about 18,000","Latin Christianity","the city commune"],
  ["8th c. BC","about 35,000","Latin Christianity","the papal see"],
  ["Etruscan/Roman era","about 15,000","Latin Christianity","the city commune"],
  ["7th c. BC","over 200,000","Orthodox Christianity","the Byzantine Emperor"],
  ["4th c. BC","about 30,000","Orthodox Christianity","the Byzantine Emperor"],
  ["9th c.","about 20,000","Orthodox Christianity","the Novgorod veche and prince"],
  ["9th c.","about 8,000","Orthodox Christianity","a Rus' prince"],
  ["862 AD","about 6,000","Orthodox Christianity","the princes of Polotsk"],
  ["9th c.","about 8,000","Latin Christianity","the Duke of Saxony"],
  ["8th c.","about 7,000","Latin Christianity","the Archbishop of Bremen"],
  ["Roman era","about 8,000","Latin Christianity","the Bishop of Utrecht"],
  ["Roman era","about 20,000","Latin Christianity","the Count of Barcelona"],
  ["Roman era","about 15,000","Latin Christianity","the King of Castile"],
  ["Roman era","about 60,000","Islam, Christian and Jewish communities","the Emirate authority of al-Andalus"],
  ["Roman era","about 45,000","Islam, Christian and Jewish communities","the Emirate authority of al-Andalus"],
  ["ancient settlement","about 15,000","Latin Christianity","the Count of Portugal"]
];
function cityProfile(index){
  return (lang==="en" && cityProfilesEn[index])?cityProfilesEn[index]:cityProfiles[index];
}

const routes = [
  {id:0,from:0,to:1,name:"Краків → Київ",days:4,risk:"Середній",fee:28},
  {id:1,from:0,to:3,name:"Краків → Прага",days:3,risk:"Низький",fee:22},
  {id:2,from:1,to:0,name:"Київ → Краків",days:4,risk:"Середній",fee:28},
  {id:3,from:1,to:2,name:"Київ → Венеція",days:6,risk:"Високий",fee:45},
  {id:4,from:2,to:0,name:"Венеція → Краків",days:5,risk:"Середній",fee:38},
  {id:5,from:2,to:3,name:"Венеція → Прага",days:4,risk:"Низький",fee:30},
  {id:6,from:3,to:2,name:"Прага → Венеція",days:4,risk:"Середній",fee:30},
  {id:7,from:3,to:0,name:"Прага → Краків",days:3,risk:"Низький",fee:22}
];

const dailyEvents = [
  ["Знайдений гаманець","На подвір’ї штабу слуга знайшов загублений гаманець із монетами. Власник так і не з’явився, тому гроші залишилися у скарбниці.",80,0],
  ["Дрібна крадіжка","Вночі хтось проник на склад і виніс частину дрібних товарів. Охорона клянеться, що бачила тінь біля задніх воріт.",-60,0],
  ["Вдалий торг","Місцевий купець терміново викупив партію товару дорожче ринку. Чутки про твою спритність поширились містом.",75,1],
  ["Хвороба у штабі","Кілька людей скаржаться на гарячку і слабкість. Лікар бере плату наперед.",-70,0],
  ["Щедрий меценат","Знатний пан помітив твою діяльність і зробив внесок. Він натякнув на вигідне замовлення.",110,2],
  ["Міська перевірка","До штабу прийшли чиновники з перевіркою документів. Частину грошей довелося віддати як мито.",-90,-1],
  ["Дешева партія товару","Купець поспішав продати дрібну партію нижче ціни. Ти швидко скористався нагодою.",55,0],
  ["Плітки про жорстокість","Містом ширяться неприємні чутки про твої методи управління. Люди тепер дивляться обережніше.",0,-2],
  ["Скарб у старій стіні","Під час ремонту робітники знайшли схованку зі старими монетами. Походження схованки невідоме.",130,0],
  ["Пожежа на кухні","Через необережність на кухні зайнявся вогонь. Частина припасів зіпсована.",-95,0],
  ["Добрий день на ринку","Попит у місті був незвично високий. Твої приказчики повернулися з додатковим прибутком.",50,0],
  ["Борг повернули","Старий боржник несподівано повернув частину грошей. Він перепросив за затримку.",70,1],
  ["Погана дорога","Дощі розмили шляхи навколо міста. Дрібні витрати з’їдають частину казни.",-50,0],
  ["Благословення храму","Священник публічно подякував за пожертву. Репутація торгового дому зросла.",0,2],
  ["Невдалий обмін","Помічник уклав погану угоду на ринку. Ти втратив гроші, але отримав урок.",-75,0],
  ["Подарунок від ремісника","Майстер приніс якісний інструмент і невелику плату. Він просить пам’ятати про його майстерню.",45,1],
  ["Зіпсований товар","Частина припасів відсиріла через погану вентиляцію. Доведеться списати збитки.",-70,0],
  ["Найманці в таверні","Твої люди виграли суперечку в таверні й принесли гроші. Містяни говорять про них із побоюванням.",35,-1],
  ["Прибуткова новина","Ти першим дізнався про дефіцит товару в сусідньому місті. Новина допомогла заробити.",90,1],
  ["Несподіваний штраф","Міська влада ввела новий збір для торговців. Сперечатись було марно.",-100,-1],
  ["Знахідка на дорозі","Один із людей знайшов покинутий ящик із товаром. Речі вдалося продати.",50,0],
  ["Сварка працівників","У штабі спалахнула сварка між людьми. Частину часу і грошей втрачено.",-35,0],
  ["Добра слава","Покупці хвалять якість твоїх товарів. Репутація торгового дому зростає.",0,2],
  ["Підроблені монети","Тобі підсунули підроблені монети у розрахунку. Втрати невеликі, але неприємні.",-45,0],
  ["Вдале полювання","Люди повернулися з м’ясом і шкурами. Частину здобичі продали.",60,0],
  ["Бунтівні настрої","Серед підневільних людей ходять небезпечні розмови. Варто уважніше стежити за порядком.",-20,-1],
  ["Знатний покупець","Представник знатної родини заплатив більше звичайного. Він чекатиме високої якості надалі.",100,1],
  ["Зламана підвода","Підвода зламалась у найгірший момент. Ремонт коштував грошей.",-65,0],
  ["Переоцінка запасів","Писар знайшов помилку в обліку на твою користь. Частина майна не була врахована.",40,0],
  ["Нічний грабіжник","Охорона спіймала грабіжника біля складу. Частину речей повернули, а місто оцінило пильність.",25,1]
];

const travelEvents = [
  {title:"Мито на мосту",text:"Місцевий володар зажадав платню за проїзд через міст.",gold:-18,reputation:0},
  {title:"Ярмарок на роздоріжжі",text:"Дорожній ярмарок дозволив вигідно обміняти дрібний крам.",gold:32,reputation:0},
  {title:"Зламана вісь",text:"Підвода потребувала термінового ремонту в найближчому селі.",gold:-26,reputation:0},
  {title:"Врятований паломник",text:"Твої люди допомогли знесиленому подорожньому, і добра слава пішла шляхом.",gold:-8,reputation:1},
  {title:"Спільний табір купців",text:"Біля вогнища вдалося укласти невелику вигідну угоду.",gold:24,reputation:1},
  {title:"Напад на узліссі",text:"Охорона відбила напад, але частина дорожніх грошей зникла.",gold:-42,reputation:-1},
  {title:"Покинутий віз",text:"На узбіччі знайшли товар, який швидко обміняли на монети.",gold:45,reputation:0},
  {title:"Порада провідника",text:"Досвідчений провідник показав безпечнішу стежку, і про торговий дім відгукнулися прихильно.",gold:-12,reputation:1}
];
const roadFearEvents = [
  "Розбійники вийшли на шлях, але впізнали знак торгового дому й розійшлися без бою.",
  "Біля лісу з'явилися озброєні люди, та лиха слава героя змусила їх відступити.",
  "Нічна засідка не наважилася напасти: провідники шепотіли про жорстку репутацію торгового дому."
];
const combatEnemyPools = [
  {kind:"bandits",title:"Зграя розбійників",titleEn:"Pack of bandits",names:["Розбійник","Лучник з узлісся","Ватажок грабіжників","Наймит із сокирою"],namesEn:["Footpad","Forest archer","Robber chief","Axe-for-hire"],loot:["Монети","Зерно","Шкіра","Зброя"]},
  {kind:"beasts",title:"Дикі звірі",titleEn:"Wild beasts",names:["Вовк","Старий вовк","Лісовий хижак","Поранений звір"],namesEn:["Wolf","Grey old wolf","Forest predator","Wounded beast"],loot:["Їжа","Шкіра","Хутро"]},
  {kind:"raiders",title:"Ворожа ватага",titleEn:"Enemy warband",names:["Дезертир","Бунтівник","Списник ватаги","Провідник ватаги"],namesEn:["Deserter","Mutineer","Warband spearman","Warband captain"],loot:["Монети","Залізо","Інструменти","Їжа"]}
];
function poolTitle(pool){return lang==="en"&&pool.titleEn?pool.titleEn:pool.title;}
function poolEnemyName(pool,index){
  if(lang==="en"&&pool.namesEn&&pool.namesEn[index]) return pool.namesEn[index];
  return pool.names[index%pool.names.length];
}
const rarityRanks = {common:1,improved:2,rare:3,epic:4,legendary:5};
const councilRequests = [
  {title:"Запаси на випадок неврожаю",goods:["Зерно","Сіль","Риба"],reason:"Міська рада наповнює комори перед можливою нестачею продовольства."},
  {title:"Ремонт мостів і брам",goods:["Залізо","Інструменти","Льон"],reason:"Мерія ремонтує міські брами та переправи, щоб торгівля не зупинилася."},
  {title:"Спорядження міської варти",goods:["Зброя","Обладунки","Коні"],reason:"Місто готує варту для захисту ярмарку й торгових шляхів."},
  {title:"Свято покровителя міста",goods:["Вино","Віск","Мед"],reason:"Міська рада готує публічне свято та потребує запасів для гостей і храмів."}
];
const relationshipRanks = [
  "Ледь знайомі","Знайомі","Доброзичливе знайомство","Виникає довіра","Близькі товариші",
  "Особиста прихильність","Сильний зв'язок","Теплі стосунки","Майже родина","Майже подружжя"
];
// Add personal interaction objects here. Supported effects: bond, affection, trust, love, loyalty and health.
const interactionCatalog = [
  {id:"conversation",name:"Поговорити",cost:0,desc:"Вислухати думки й тривоги.",scene:"Ви відклали рахункові книги й вислухали розповідь без поспіху. Розмова завершилася відчуттям, що цю людину нарешті почули.",effects:{bond:4,trust:3,affection:2}},
  {id:"shared_meal",name:"Спільна вечеря",cost:18,desc:"Провести вечір за доброю стравою.",scene:"За теплою вечерею розмова швидко відійшла від роботи. Сміх і проста їжа зробили вечір по-справжньому спокійним.",effects:{bond:6,affection:5,loyalty:1,health:1}},
  {id:"praise",name:"Похвалити працю",cost:0,desc:"Відзначити здібності та старання.",scene:"При всіх ви назвали працю гідною поваги. Визнання було прийняте стримано, але з помітною гордістю.",effects:{bond:4,trust:4,loyalty:2}},
  {id:"walk",name:"Прогулятися містом",cost:12,adultOnly:true,freeOnly:true,desc:"Поговорити далеко від справ штабу.",scene:"Ви пройшлися вулицями подалі від шуму двору. У неквапливій розмові з'явилося більше особистого, ніж звичайно.",effects:{bond:7,affection:5,love:3}},
  {id:"confide",name:"Поділитися мріями",cost:10,adultOnly:true,freeOnly:true,minRank:5,desc:"Відкритися тому, кому вже довіряєш.",scene:"Сьогодні ви говорили не про прибуток, а про майбутнє. Довірена мрія стала важливішою за будь-який подарунок.",effects:{bond:8,trust:5,love:6}},
  {id:"harsh_words",name:"Сварка",cost:0,desc:"Різка розмова залишає неприємний слід.",scene:"Слова виявилися гострішими, ніж намір. Після розмови лишилася тиша, яку буде непросто розвіяти.",effects:{bond:-8,affection:-5,trust:-6,loyalty:-2}}
];

const npcNames = {
  male:["Марек","Стефан","Павел","Іван","Богдан","Лукаш","Томаш","Миколай","Роман","Ян"],
  female:["Анна","Олена","Марта","Катерина","Софія","Дарина","Міла","Зоряна","Агата","Ганна"]
};
const npcSurnames = ["Коваль","Вишняк","Новак","Ружич","Мельник","Вовк","Зорич","Длугош","Рибак","Левицька","Крамар","Синиця","Боровик","Горська","Ткач"];
const regionalNpcNames = {
  default:{
    male:[["Марек","Marek"],["Стефан","Stefan"],["Павел","Pavel"],["Іван","Ivan"],["Богдан","Bohdan"],["Роман","Roman"],["Ян","Jan"],["Миколай","Mykolai"]],
    female:[["Анна","Anna"],["Олена","Olena"],["Марта","Marta"],["Катерина","Kateryna"],["Софія","Sofia"],["Дарина","Daryna"],["Агата","Agata"],["Ганна","Hanna"]],
    surnames:[["Коваль","Koval"],["Вишняк","Vyshniak"],["Новак","Novak"],["Мельник","Melnyk"],["Вовк","Vovk"],["Крамар","Kramar"],["Ткач","Tkach"]]
  },
  "Польща":{
    male:[["Мацей","Maciej"],["Станіслав","Stanislaw"],["Болеслав","Boleslaw"],["Казимир","Kazimierz"],["Войцех","Wojciech"],["Яцек","Jacek"],["Пшемисл","Przemysl"],["Миколай","Mikolaj"]],
    female:[["Ядвіга","Jadwiga"],["Зофія","Zofia"],["Мальґожата","Malgorzata"],["Аґнешка","Agnieszka"],["Ельжбета","Elzbieta"],["Катажина","Katarzyna"],["Добрава","Dobrawa"],["Барбара","Barbara"]],
    surnames:[["Ковалик","Kowalik"],["Новак","Nowak"],["Вишневський","Wisniewski"],["Зелінський","Zielinski"],["Лісовський","Lisowski"],["Краківський","Krakowski"]]
  },
  "Русь":{
    male:[["Ярослав","Yaroslav"],["Святослав","Sviatoslav"],["Мстислав","Mstyslav"],["Всеволод","Vsevolod"],["Добриня","Dobrynia"],["Ілля","Illia"],["Лука","Luka"],["Остап","Ostap"]],
    female:[["Предслава","Predslava"],["Єфросинія","Yefrosynia"],["Милана","Milana"],["Любава","Liubava"],["Зоряна","Zoriana"],["Олена","Olena"],["Марія","Maria"],["Василиса","Vasylysa"]],
    surnames:[["Киянин","Kyianyn"],["Новгородець","Novgorodets"],["Полочанин","Polochanin"],["Смолянин","Smolianyn"],["Вовк","Vovk"],["Бортник","Bortnyk"]]
  },
  "Італія":{
    male:[["Маттео","Matteo"],["Лоренцо","Lorenzo"],["Джованні","Giovanni"],["Марко","Marco"],["П'єтро","Pietro"],["Нікколо","Niccolo"],["Антоніо","Antonio"],["Данте","Dante"]],
    female:[["Б'янка","Bianca"],["Лючія","Lucia"],["Катерина","Caterina"],["Ізабелла","Isabella"],["Франческа","Francesca"],["Джулія","Giulia"],["Алессандра","Alessandra"],["К'яра","Chiara"]],
    surnames:[["Белліні","Bellini"],["Річчі","Ricci"],["Контаріні","Contarini"],["Вісконті","Visconti"],["Медічі","Medici"],["Пізано","Pisano"]]
  },
  "Богемія":{
    male:[["Вацлав","Vaclav"],["Пржемисл","Premysl"],["Отакар","Otakar"],["Богуміл","Bohumil"],["Ян","Jan"],["Зденек","Zdenek"],["Микулаш","Mikulas"],["Радек","Radek"]],
    female:[["Людмила","Ludmila"],["Божена","Bozena"],["Мілада","Milada"],["Власта","Vlasta"],["Елішка","Eliska"],["Анна","Anna"],["Здена","Zdena"],["Маркета","Marketa"]],
    surnames:[["Новак","Novak"],["Свобода","Svoboda"],["Дворжак","Dvorak"],["Черний","Cerny"],["Празький","Prazsky"],["Кубік","Kubik"]]
  },
  "Англія":{
    male:[["Вільям","William"],["Генрі","Henry"],["Томас","Thomas"],["Роберт","Robert"],["Едмунд","Edmund"],["Річард","Richard"],["Джон","John"],["Освальд","Oswald"]],
    female:[["Аліса","Alice"],["Елеонора","Eleanor"],["Матильда","Matilda"],["Маргарет","Margaret"],["Едіт","Edith"],["Джоан","Joan"],["Агнес","Agnes"],["Сесілія","Cecily"]],
    surnames:[["Сміт","Smith"],["Бейкер","Baker"],["Картер","Carter"],["Флетчер","Fletcher"],["Йоркський","of York"],["Лондонер","Londoner"]]
  },
  "Франція":{
    male:[["Луї","Louis"],["Філіп","Philippe"],["Гійом","Guillaume"],["Етьєн","Etienne"],["П'єр","Pierre"],["Жак","Jacques"],["Анрі","Henri"],["Гуго","Hugues"]],
    female:[["Марі","Marie"],["Аделаїда","Adelaide"],["Бланш","Blanche"],["Ізабель","Isabelle"],["Жанна","Jeanne"],["Клеманс","Clemence"],["Елоїза","Heloise"],["Марґеріт","Marguerite"]],
    surnames:[["Леклерк","Leclerc"],["Моро","Moreau"],["Дюбуа","Dubois"],["Буше","Boucher"],["Парижанин","Parisien"],["Лефевр","Lefevre"]]
  },
  "Нормандія":{
    male:[["Рауль","Raoul"],["Гійом","Guillaume"],["Роже","Roger"],["Жоффруа","Geoffroi"],["Ансельм","Anselm"],["Рено","Renaud"],["Танкред","Tancred"],["Ед","Eudes"]],
    female:[["Адель","Adele"],["Емма","Emma"],["Ізабель","Isabelle"],["Матильда","Mathilde"],["Сибіла","Sibylle"],["Алієнора","Alienor"],["Гіза","Giselle"],["Кларисса","Clarisse"]],
    surnames:[["де Руан","de Rouen"],["де Кан","de Caen"],["Мартель","Martel"],["Фурньє","Fournier"],["Леру","Leroux"],["Норман","Norman"]]
  },
  "Фландрія":{
    male:[["Бодуен","Boudewijn"],["Дірк","Dirk"],["Ламберт","Lambert"],["Пітер","Pieter"],["Герріт","Gerrit"],["Ян","Jan"],["Віллем","Willem"],["Флоріс","Floris"]],
    female:[["Марґріт","Margriet"],["Беатріс","Beatrix"],["Клара","Clara"],["Ельза","Elsa"],["Алейда","Aleida"],["Катрін","Katrien"],["Іда","Ida"],["Матільда","Mathilde"]],
    surnames:[["ван Брюгге","van Brugge"],["ван Гент","van Gent"],["Декер","Dekker"],["де Вевер","de Wever"],["Вермеєр","Vermeer"],["Ван ден Берг","van den Berg"]]
  },
  "Священна Римська імперія":{
    male:[["Отто","Otto"],["Фрідріх","Friedrich"],["Гайнріх","Heinrich"],["Конрад","Konrad"],["Рупрехт","Ruprecht"],["Дітріх","Dietrich"],["Альбрехт","Albrecht"],["Вольфрам","Wolfram"]],
    female:[["Гертруда","Gertrud"],["Гільдегарда","Hildegard"],["Адельгейда","Adelheid"],["Кунігунда","Kunigunde"],["Ельза","Elsa"],["Ірмґард","Irmgard"],["Брунгільда","Brunhild"],["Анна","Anna"]],
    surnames:[["Шмідт","Schmidt"],["Мюллер","Muller"],["Вебер","Weber"],["Фішер","Fischer"],["Кельнер","Kolner"],["Шнайдер","Schneider"]]
  },
  "Австрія":{
    male:[["Леопольд","Leopold"],["Оттокар","Ottokar"],["Гайнріх","Heinrich"],["Рудольф","Rudolf"],["Ульріх","Ulrich"],["Вальтер","Walther"],["Гартман","Hartmann"],["Ернст","Ernst"]],
    female:[["Агнес","Agnes"],["Гертруда","Gertrud"],["Маргарета","Margarete"],["Катаріна","Katharina"],["Анна","Anna"],["Елізабет","Elisabeth"],["Гедвіга","Hedwig"],["Клара","Klara"]],
    surnames:[["фон Відень","von Wien"],["Зальцбургер","Salzburger"],["Штайнер","Steiner"],["Бергер","Berger"],["Грубер","Gruber"],["Хофер","Hofer"]]
  },
  "Візантія":{
    male:[["Олексій","Alexios"],["Мануїл","Manuel"],["Ісаак","Isaakios"],["Никифор","Nikephoros"],["Михаїл","Michael"],["Андронік","Andronikos"],["Георгій","Georgios"],["Костянтин","Konstantinos"]],
    female:[["Ірина","Eirene"],["Анна","Anna"],["Феодора","Theodora"],["Євдокія","Eudokia"],["Зоя","Zoe"],["Марія","Maria"],["Олена","Helena"],["Касія","Kassia"]],
    surnames:[["Комнін","Komnenos"],["Дука","Doukas"],["Палеолог","Palaiologos"],["Кантакузин","Kantakouzenos"],["Фока","Phokas"],["Варяг","Varangios"]]
  },
  "Саксонія":{
    male:[["Герман","Hermann"],["Бернард","Bernhard"],["Людольф","Liudolf"],["Еккехард","Ekkehard"],["Бруно","Bruno"],["Готфрід","Gottfried"],["Ганс","Hans"],["Клаус","Klaus"]],
    female:[["Матильда","Mathilde"],["Ода","Oda"],["Іда","Ida"],["Емма","Emma"],["Гедвіга","Hedwig"],["Грета","Greta"],["Ельза","Elsa"],["Ліза","Liese"]],
    surnames:[["Саксон","Saxon"],["Бремер","Bremer"],["Гамбургер","Hamburger"],["Крамер","Kramer"],["Бауер","Bauer"],["Шульц","Schulz"]]
  },
  "Нідерланди":{
    male:[["Дірк","Dirk"],["Флоріс","Floris"],["Віллем","Willem"],["Пітер","Pieter"],["Гейс","Gijs"],["Якоб","Jacob"],["Герріт","Gerrit"],["Клас","Klaas"]],
    female:[["Алейда","Aleida"],["Беатрікс","Beatrix"],["Гертруда","Geertruid"],["Клара","Clara"],["Маріке","Marieke"],["Лісбет","Liesbeth"],["Анна","Anna"],["Іда","Ida"]],
    surnames:[["ван Утрехт","van Utrecht"],["де Йонг","de Jong"],["ван Дейк","van Dijk"],["Баккер","Bakker"],["Купман","Koopman"],["Віссер","Visser"]]
  },
  "Каталонія":{
    male:[["Рамон","Ramon"],["Бернат","Bernat"],["Арнау","Arnau"],["Жауме","Jaume"],["Пере","Pere"],["Гільєм","Guillem"],["Ферран","Ferran"],["Марті","Marti"]],
    female:[["Еулалія","Eulalia"],["Монсеррат","Montserrat"],["Бернарда","Bernarda"],["Марія","Maria"],["Адела","Adela"],["Клара","Clara"],["Ізабель","Isabel"],["Тереза","Teresa"]],
    surnames:[["Барселонський","Barceloni"],["Пужоль","Pujol"],["Серра","Serra"],["Феррер","Ferrer"],["Ровіра","Rovira"],["Кардона","Cardona"]]
  },
  "Кастилія":{
    male:[["Альфонсо","Alfonso"],["Фернандо","Fernando"],["Родріго","Rodrigo"],["Дієго","Diego"],["Санчо","Sancho"],["Гонсало","Gonzalo"],["Мартін","Martin"],["Енріке","Enrique"]],
    female:[["Інес","Ines"],["Хімена","Jimena"],["Беатріс","Beatriz"],["Леонор","Leonor"],["Уррака","Urraca"],["Тереза","Teresa"],["Ельвіра","Elvira"],["Марія","Maria"]],
    surnames:[["де Толедо","de Toledo"],["Гарсія","Garcia"],["Фернандес","Fernandez"],["Родрігес","Rodriguez"],["Кастільйо","Castillo"],["Ерреро","Herrero"]]
  },
  "Аль-Андалус":{
    male:[["Ісмаїл","Ismail"],["Юсуф","Yusuf"],["Ахмад","Ahmad"],["Абдалла","Abdallah"],["Муса","Musa"],["Хасан","Hasan"],["Ібрагім","Ibrahim"],["Омар","Umar"]],
    female:[["Фатіма","Fatima"],["Айша","Aisha"],["Зайнаб","Zaynab"],["Мар'ям","Maryam"],["Лейла","Layla"],["Хадіджа","Khadija"],["Сафія","Safiya"],["Аміна","Amina"]],
    surnames:[["аль-Куртубі","al-Qurtubi"],["аль-Ішбілі","al-Ishbili"],["ібн Рашид","ibn Rashid"],["аль-Таджир","al-Tajir"],["аль-Хаддад","al-Haddad"],["аль-Варрак","al-Warraq"]]
  },
  "Іберія":{
    male:[["Афонсу","Afonso"],["Дініш","Dinis"],["Жуан","Joao"],["Мартім","Martim"],["Гонсалу","Goncalo"],["Педру","Pedro"],["Вашку","Vasco"],["Ештеван","Estevao"]],
    female:[["Леонор","Leonor"],["Інеш","Ines"],["Брітеc","Brites"],["Тереза","Teresa"],["Марія","Maria"],["Констанса","Constanca"],["Мафалда","Mafalda"],["Ізабел","Isabel"]],
    surnames:[["де Лісбоа","de Lisboa"],["Перейра","Pereira"],["Кошта","Costa"],["Сілва","Silva"],["Феррейра","Ferreira"],["Марінью","Marinho"]]
  }
};
// Add set IDs here after placing additional portrait folders under assets/npc/.
// v0.43: free female NPCs now use all 5 panel slots (female_01..female_05),
// matching the 5-panel women atlas. Slave/serf variants stay separate.
const npcPortraitSets = {
  male:["male_01","male_slave_01","male_slave_02","male_slave_03","male_slave_04","male_slave_05"],
  female:["female_01","female_02","female_03","female_04","female_05","female_slave_01","female_slave_02","female_slave_03","female_slave_04","female_slave_05","female_serf_01","female_serf_02","female_serf_03","female_serf_04","female_serf_05"]
};
const freeRoles = [
  {profession:"Носій",price:108,img:"assets/free_worker.png"},
  {profession:"Ткачка",price:148,img:"assets/craftswoman.png"},
  {profession:"Коваль",price:176,img:"assets/free_worker.png"},
  {profession:"Охоронець",price:166,img:"assets/guard.png"},
  {profession:"Писар",price:132,img:"assets/free_worker.png"},
  {profession:"Візник",price:142,img:"assets/guard.png"},
  {profession:"Кухарка",price:138,img:"assets/craftswoman.png"},
  {profession:"Корчмар",price:150,img:"assets/free_worker.png"}
];
const slaveRoles = [
  {profession:"Підневільний робітник",price:78,img:"assets/slave_worker.png"},
  {profession:"Підневільна пряля",price:86,img:"assets/slave_worker.png"},
  {profession:"Підневільний вантажник",price:92,img:"assets/slave_male.png"}
];
const npcTraits = [
  {key:"artisan",name:"Умілі руки",description:"З дитинства знає ремесло і помічає дрібні похибки.",effect:"Ремесло +2",stat:"craft",bonus:2},
  {key:"vigilant",name:"Пильний погляд",description:"Помічає рух у провулках раніше за інших.",effect:"Бій +2",stat:"combat",bonus:2},
  {key:"strong",name:"Дужий",description:"Звик до важкої роботи й довгого шляху.",effect:"Сила +2",stat:"strength",bonus:2},
  {key:"organized",name:"Ощадний",description:"Веде порядок у мішках і не губить товар у метушні.",effect:"+3 місткості на складі",stat:null,bonus:0},
  {key:"kind",name:"Добросердий",description:"Легко знаходить спільну мову з мешканцями штабу.",effect:"Лояльність +2",stat:"loyalty",bonus:2},
  {key:"reserved",name:"Мовчазний",description:"Мало розповідає про себе, але уважно слухає.",effect:"Покірність +2",stat:"obedience",bonus:2},
  {key:"resilient",name:"Витривалий",description:"Переніс тяжкі роки й рідко скаржиться на втому.",effect:"Здоров’я +2",stat:"health",bonus:2},
  {key:"welcoming",name:"Привітний",description:"Уміє вислухати подорожнього і створити добру атмосферу.",effect:"Гостинність +2",stat:"service",bonus:2}
];
const npcHistories = [
  "Колись працював на ярмаркових возах і знає запах кожного торгового двору.",
  "Втратив дім після неврожаю та шукає місце, де можна почати знову.",
  "Навчився ремеслу в родині, але мусив залишити майстерню через борги.",
  "Пам’ятає кілька далеких доріг і завжди розпитує мандрівників про новини.",
  "Любить тихі ранки біля ринку та зберігає маленький різьблений оберіг.",
  "Колись доглядав коней і досі впізнає хорошу тварину з першого погляду."
];
const npcHopes = [
  "мріє колись відкрити власну лавку",
  "хоче зібрати гроші для родини",
  "прагне навчитися новому ремеслу",
  "сподівається побачити Венецію",
  "хоче мати безпечне житло",
  "мріє заслужити повагу міста"
];
const npcLikes = [
  "теплий хліб, тихі вечори та розмови біля вогню",
  "добрих коней, далекі дороги та спів мандрівників",
  "акуратні інструменти, порядок і чесну оплату",
  "яскраві тканини, свята й новини з інших міст",
  "садові трави, дощ за вікном і старі пісні",
  "книги рахунків, шахи та спокійний ринок зранку"
];
const npcDislikes = [
  "галасливі сварки й марнотратство",
  "холодні ночі та несправедливі накази",
  "брехню на торгах і зламані інструменти",
  "самотність і довгі голодні переходи",
  "пожежі, борги та грубе поводження",
  "хаос у роботі й непевні обіцянки"
];
const npcFamilyStatuses = [
  "Неодружений / неодружена",
  "Має родину в рідному місті",
  "Вдівець / вдова",
  "Заручений / заручена",
  "Піклується про молодшого родича"
];
const hiddenPlaces = {
  witch:{title:"Лавка старої ворожки",image:"assets/hidden/witch.jpg",route:[1,33],
    desc:"На краю занедбаного тракту між Києвом і Лісабоном стоїть похила лавка, обвішана сушеними травами. Стара ворожка Мирослава колись була лікаркою при княжому дворі, але після невдалого пророцтва — нібито побачила смерть князевого первістка — її вигнали з міста назавжди. Вона вижила серед доріг, навчилась слухати хвороби й тепер продає те, що називає еліксиром життя.",
    lore:"Кажуть, у запиленій скрині під лавкою лежить зілля, що повертає душу з порога смерті. Вона варить його з ягід глоду, серця білого вовка, корня мандрагори, восковини джмеля та краплі живиці тисячолітнього дуба. За одну склянку Мирослава просить 600 монет — і ніколи не торгується, бо «жодна ціна не дорівнює одному зайвому подиху».",
    titleEn:"The old witch's shack",
    descEn:"On the edge of a forgotten road between Kyiv and Lisbon stands a leaning shack hung with dried herbs. Old Myroslava was once a healer at a prince's court, until a failed prophecy — she claimed to see the death of the prince's firstborn — got her exiled forever. She survived the roads, learned to listen to illnesses, and now sells what she calls the elixir of life.",
    loreEn:"They say a dusty chest beneath her bench holds a potion that calls the soul back from the doorstep of death. She brews it from hawthorn berries, the heart of a white wolf, mandrake root, bumblebee wax and a drop of resin from a thousand-year oak. For a single phial she asks 600 coins — and never haggles, for «no price equals one extra breath»."
  },
  circus:{title:"Бродячий цирк",image:"assets/hidden/circus.jpg",chance:0.03,
    quest:{need:{"Одяг":2,"Мед":1,"Прикраси":1,"Шкіра":1},rewards:["clown_cap","clown_boots"]},
    hideRewards:true,hideNeed:true,
    desc:"На світанку дорогу перетинають строкаті вози, канатоходці, музики й люди з усмішками, які знають забагато чужих таємниць. Карликовий лев, жонглери з вогнем і ведмідь, що танцює гавот — кожна вистава дивує, кожен погляд натякає на щось більше.",
    lore:"Старший трупи — грім-чоловік на ім'я Жакомо — кладе важку руку тобі на плече: «Принеси мені <b>одяг, виткане у місті каналів і дзвонів</b>. Принеси <b>мед, що збирають у північних борах за озером Ільмень</b>. Принеси <b>прикраси, що сяють у мавританських дворах</b>. І принеси <b>шкіру з англійських острівних чинбарень</b>. Що буде далі? Це побачиш сам — у нашому ремеслі сюрприз цінніший за обіцянку. Слухай гомін у таверні: твоя дорога підкаже».",
    titleEn:"Wandering circus",
    descEn:"At dawn the road is crossed by gaudy wagons, tightrope walkers, musicians and people whose smiles know too many secrets. A dwarf lion, fire-jugglers, and a bear dancing the gavotte — every show amazes, every glance hints at something more.",
    loreEn:"The troupe's leader, a thunder-voiced man named Giacomo, lays a heavy hand on your shoulder: «Bring me <b>clothing woven in a city of canals and bells</b>. Bring <b>honey gathered in the northern pine forests beyond Lake Ilmen</b>. Bring <b>jewelry that glitters in Moorish courts</b>. And bring <b>leather from the English islands' tanneries</b>. What follows? You'll see — in our trade a surprise is worth more than a promise. Listen to the talk in taverns: your road will tell you.»"
  },
  scholars:{title:"Караван науковців",image:"assets/hidden/scholars.jpg",chance:0.03,
    quest:{need:{"Скло":2,"Срібло":2,"Шкіра":2,"Прянощі":1,"Шовк":1},rewards:["scholar_motion_talisman"]},
    hideRewards:true,hideNeed:true,
    desc:"Під охороною старих прапорів рухається караван писарів, лікарів і астрономів з Болонської та Падуанської шкіл. Шість возів, повних карт, астролябій, посудин зі скляними лінзами і книг у шкіряних оправах. Вони збирають дані для великого трактату «Шляхи Європи».",
    lore:"Голова каравану, магістр Бенедикт, відкладає перо і чітко дивиться тобі в очі: «Якщо хочеш, щоб я зробив тобі річ, якої немає у жодного купця Європи, принеси: <b>прозоре скло, видуте у місті лагуни</b>; <b>срібло з ганзейських ваг північного порту</b>; <b>тонку шкіру з міста двадцяти університетських веж</b>; <b>прянощі з нащадків Риму над Босфором</b>; і <b>шовк зі стародавнього мегаполісу Святого Димитрія</b>. З цих п'яти інгредієнтів я викую тобі прилад, який міняє саме плин часу. Який саме — побачиш на власні руки. У таверні почуєш імена міст».",
    titleEn:"Scholars' caravan",
    descEn:"Under old banners moves a caravan of scribes, physicians and astronomers from the schools of Bologna and Padua. Six wagons full of maps, astrolabes, vessels with glass lenses and books in leather bindings. They are gathering data for the great treatise «The Roads of Europe».",
    loreEn:"The head of the caravan, Magister Benedictus, sets aside his quill and looks you straight in the eye: «If you want me to make you a thing no merchant in Europe owns, bring: <b>clear glass blown in the city of the lagoon</b>; <b>silver from the Hanseatic scales of the northern port</b>; <b>fine leather from the city of twenty university towers</b>; <b>spices from the heirs of Rome above the Bosporus</b>; and <b>silk from the ancient metropolis of Saint Demetrius</b>. From these five I will forge for you an instrument that bends time itself. What kind — you will see by your own hands. In the taverns you will hear the names of the cities.»"
  },
  smiths:{title:"Таємне поселення ковалів",image:"assets/hidden/smiths.jpg",route:[0,25],
    quest:{need:{"Залізо":3,"Срібло":2,"Інструменти":2,"Сіль":2,"Вино":1},rewards:["legendary_forge_blade","legendary_forge_armor"]},
    hideRewards:true,hideNeed:true,
    desc:"Між Краковом і Полоцьком, у балці яку оминають усі лісники, димлять горни, яких немає на жодній мапі. Поселення ховається три покоління — кажуть, ще з часів, коли давнина не була казкою. Голова поселення, майстер Радомир, приймає лише тих, хто довів користь домові металом і чесним словом.",
    lore:"Радомир дивиться у твої руки і каже тихо: «Якщо хочеш бачити, на що здатне моє горно, принеси мені <b>те, що пам'ятає удар з неба</b>. Принеси <b>срібло, що тече крізь землю в одному королівстві з трьома цеглинами</b>. Принеси <b>гартоване вогнем у лісах між Києвом і Полоцьком</b>. Принеси <b>сіль із міста, чия назва — фортеця солі</b>. І знайди <b>те, що подорожні називають кров'ю останнього звіра</b>. Що з цього вийде — я скажу, коли побачу всі п'ять разом. Слухай таверни, торговцю: чутки знають більше за мене».",
    titleEn:"Secret smiths' settlement",
    descEn:"Between Kraków and Polotsk, in a hollow that foresters avoid, smoke rises from forges that appear on no map. The settlement has hidden for three generations — they say since the time when antiquity was not yet a tale. The head of the settlement, master Radomir, only receives those who have proved their use to the house with metal and honest word.",
    loreEn:"Radomir looks into your hands and says softly: «If you want to see what my forge can do, bring me <b>that which remembers a blow from the sky</b>. Bring <b>silver that runs through the earth in a kingdom of three bricks</b>. Bring <b>that which was tempered by fire in the forests between Kyiv and Polotsk</b>. Bring <b>salt from the city whose very name is 'fortress of salt'</b>. And find <b>what travellers call the blood of the last beast</b>. What will come of it — I will tell you when I see all five together. Listen in the taverns, merchant: rumours know more than I do.»"
  }
};

// === v0.43: Tavern rumours that decode the smiths' riddle ===
// Each rumour points to a city that supplies the required ingredient.
// Player must visit each city and overhear the rumour to decode the recipe.
const TAVERN_RUMORS=[
  // === Smiths' secret recipe (5) ===
  {id:"meteor_iron",place:"smiths",city:25/*Polotsk*/,good:"Залізо",
    uk:"🍻 У полоцькій корчмі літня жінка шепоче: «Селяни тутешніх лісів знаходять важкі чорні камені після зоряних дощів. Місцеві ковалі плавлять їх у залізо темніше за звичайне. Кажуть, у горні воно гудить, мов гроза».",
    en:"🍻 In a Polotsk tavern, an old woman whispers: «Peasants of these forests find heavy black stones after the star-rains. The local smiths melt them into iron darker than ordinary. In the forge — they say — it hums like a thunderstorm.»"},
  {id:"bohemia_silver",place:"smiths",city:3/*Prague*/,good:"Срібло",
    uk:"🍻 Празький кравець п'є пиво й бурмоче: «У наших горах срібло — як трава у долинах. Жінки збирають його з річок ситом, як рибу. Кажуть, у країні з трьома цеглинами на гербі — а в нас саме три. Хочеш срібла — купуй у Празі».",
    en:"🍻 A Prague tailor drinks his beer and mumbles: «In our hills silver is like grass in a valley. The women catch it from the rivers with sieves, as if fish. They say — in the kingdom of three bricks. We do have three. You want silver? Buy it in Prague.»"},
  {id:"thunder_oak",place:"smiths",city:24/*Smolensk*/,good:"Інструменти",
    uk:"🍻 Смоленський лісник за чаркою хвалиться: «У наших борах ростуть дуби, у які бив грім тричі. Селяни випалюють із них вугілля, а з того вугілля коваль виковує інструмент, що ріже залізо, мов хліб. У нас такі інструменти і продаються — лісовим людям не дивно».",
    en:"🍻 A Smolensk forester boasts over a cup: «In our pine groves grow oaks struck by thunder three times. Peasants burn charcoal from them, and from that charcoal a smith forges tools that cut iron like bread. We sell such tools here — it's no wonder to forest folk.»"},
  {id:"salt_fortress",place:"smiths",city:14/*Salzburg*/,good:"Сіль",
    uk:"🍻 У зальцбурзькому шинку купець-німець хитро посміхається: «Salz-burg — “Фортеця Солі”. Гірські штольні під містом тягнуться милями вглиб. Найкращу сіль усієї Європи б'ють тут — і кажуть, вона тримає вогонь у самій крицевій душі».",
    en:"🍻 In a Salzburg inn a German merchant smiles slyly: «Salz-burg — “the fortress of salt”. The mine shafts beneath the city stretch for miles. The finest salt in all Europe is hewn here — and they say it holds the very fire in a steel soul.»"},
  {id:"last_beast_blood",place:"smiths",city:31/*Cordoba*/,good:"Вино",
    uk:"🍻 У кордовській харчевні мавр-винороб посміхається: «Наше вино таке густе й темне, що подорожні називають його кров'ю останнього звіра. Хто скуштував — клянеться, що воно горить у горлі, мов залізо у горні. Дві склянки і людина боїться лише зорі».",
    en:"🍻 In a Cordoba inn a Moorish vintner smiles: «Our wine is so dark and thick that travellers call it the blood of the last beast. Whoever has tasted it swears it burns the throat like iron in a forge. Two cups, and a man fears only the dawn.»"},
  // === Scholars' astrolabe (5) ===
  {id:"venice_glass",place:"scholars",city:2/*Venice*/,good:"Скло",
    uk:"🍻 У венеціанській таверні гондольєр піднімає келих: «Наші склодуви Мурано — як алхіміки. Скло у них прозоріше за лагуну, легше за повітря. Лінзи з нашого скла бачать місяць так близько, що можна порахувати камені на ньому».",
    en:"🍻 In a Venetian tavern a gondolier lifts his glass: «Our Murano glassblowers are like alchemists. Their glass is clearer than the lagoon, lighter than air. Lenses from our glass see the moon so close you can count the stones on it.»"},
  {id:"hamburg_silver",place:"scholars",city:26/*Hamburg*/,good:"Срібло",
    uk:"🍻 У гамбурзькій корчмі ганзейський купець стукає по столу: «Усе срібло Європи проходить через наші ваги. Північний порт — це серце ганзи. Чисте, важке срібло наших кравенів використовують у Падуї та Болоньї для дзеркал і астрономічних приладів».",
    en:"🍻 In a Hamburg tavern a Hanseatic merchant raps the table: «All the silver of Europe passes our scales. The northern port is the heart of the Hanse. Our pure, heavy silver is used in Padua and Bologna for mirrors and astronomical instruments.»"},
  {id:"bologna_leather",place:"scholars",city:20/*Bologna*/,good:"Шкіра",
    uk:"🍻 Болонський студент за глеком вина: «У нашому місті двадцять університетських веж. Шкіряники працюють лише на школу: тонкий пергамент для книг, оправи для трактатів, мапи в шкіряних футлярах. Купити справжню вчену шкіру можна тільки тут».",
    en:"🍻 A Bologna student over a pitcher of wine: «Our city has twenty university towers. The tanners work only for the school: thin parchment for books, bindings for treatises, maps in leather cases. True scholarly leather can be bought only here.»"},
  {id:"constantinople_spices",place:"scholars",city:21/*Constantinople*/,good:"Прянощі",
    uk:"🍻 У константинопольській харчевні писар з Босфору шепоче: «Наша імперія тримається на спеціях. Гвоздика, мускат, шафран — усі вони сходяться тут, бо ми — спадкоємці Риму над протокою. З наших прянощів ченці роблять чорнило, що пахне небом».",
    en:"🍻 In a Constantinople inn a scribe by the Bosporus whispers: «Our empire stands on spices. Cloves, nutmeg, saffron — all converge here, for we are the heirs of Rome above the strait. From our spices, monks make ink that smells of heaven.»"},
  {id:"thessalonica_silk",place:"scholars",city:22/*Thessalonica*/,good:"Шовк",
    uk:"🍻 У салонікській корчмі грецький ткач хвалиться: «Місто Святого Димитрія старіше за пам'ять. Наші шовкопряди годують гусень тутових листів вже тисячу років. Шовк з Салонік — тонший за вухо метелика. Його використовують для оправ найдорожчих манускриптів».",
    en:"🍻 In a Thessalonica tavern a Greek weaver boasts: «The city of Saint Demetrius is older than memory. Our silkworms have fed on mulberry leaves for a thousand years. Silk from Thessalonica is finer than a moth's ear. It is used in the binding of the costliest manuscripts.»"},
  // === Wandering circus (4) ===
  {id:"ghent_clothing",place:"circus",city:9/*Ghent*/,good:"Одяг",
    uk:"🍻 У ґентському шинку фламандський ткач підморгує: «Наше місто — як великий ткацький верстат. Канали, дзвони і гільдія сукноробів — все працює як єдиний механізм. Барвистий одяг наших артистів видно за льє. Кращого костюма для блазня не знайдеш».",
    en:"🍻 In a Ghent tavern a Flemish weaver winks: «Our city is like a great loom. Canals, bells and the cloth guild — all working as one mechanism. The colourful clothing of our performers is visible a league away. You won't find a better jester's costume.»"},
  {id:"novgorod_honey",place:"circus",city:23/*Novgorod*/,good:"Мед",
    uk:"🍻 У новгородській корчмі бородатий пасічник з вишкірив усмішку: «За озером Ільмень стоять старі бори. Бортники збирають у них мед такий, що ведмідь забуває, навіщо прийшов. Хочеш приборкати звіра — наш мед п'янить його швидше за хмільне молоко».",
    en:"🍻 In a Novgorod tavern a bearded beekeeper grins: «Beyond Lake Ilmen stand the old pine forests. Our wild beekeepers gather honey that makes a bear forget why he came. Want to tame a beast? Our honey intoxicates him faster than fermented milk.»"},
  {id:"seville_jewelry",place:"circus",city:32/*Seville*/,good:"Прикраси",
    uk:"🍻 У севільській таверні мавританська жінка перебирає браслети: «У мавританських дворах золото й коштовності виблискують так, що танцівниці здаються вогняними птахами. Наші ювеліри роблять прикраси для аль-андалуських емірів. У бідного купця — і то є шанс купити».",
    en:"🍻 In a Seville tavern a Moorish woman fingers her bracelets: «In Moorish courts gold and jewels shine so that dancers seem like birds of fire. Our jewellers craft adornments for the emirs of al-Andalus. Even a poor merchant has a chance to buy.»"},
  {id:"york_leather",place:"circus",city:5/*York*/,good:"Шкіра",
    uk:"🍻 У йоркському шинку англійський чинбар витирає руки: «Острівні чинбарні — найкращі в Європі. Наша шкіра витримує дощ і вогонь. Мандрівні циркачі замовляють у нас маски для левових приборкувачів — лев гризе, а маска тримає».",
    en:"🍻 In a York tavern an English tanner wipes his hands: «The island tanneries are the best in Europe. Our leather endures rain and fire. Travelling circus folk order lion-tamer masks from us — the lion bites, the mask holds.»"}
];
function getRumorByCityIndex(idx){return TAVERN_RUMORS.find(r=>r.city===idx && _placeRumorActive(r));}
function _placeRumorActive(rumor){
  return player.foundHiddenPlaces && player.foundHiddenPlaces.includes(rumor.place);
}
function maybeRevealRumor(){
  if(!player) return;
  player.rumorsHeard=player.rumorsHeard||{};
  if(!player.foundHiddenPlaces) return;
  // Find all rumours in this city for places the player has discovered
  const candidates=TAVERN_RUMORS.filter(r=>r.city===currentCity && player.foundHiddenPlaces.includes(r.place) && !player.rumorsHeard[r.id]);
  if(!candidates.length) return;
  // 60% chance to reveal upon entering market
  if(Math.random()>=0.6) return;
  const rumor=candidates[0]; // reveal first unheard
  player.rumorsHeard[rumor.id]=true;
  const text=lang==="en"?rumor.en:rumor.uk;
  log(text,"travel");
}
function rumorPanelHtml(){
  if(!player||!player.rumorsHeard||!player.foundHiddenPlaces) return "";
  const heard=TAVERN_RUMORS.filter(r=>player.rumorsHeard[r.id] && player.foundHiddenPlaces.includes(r.place));
  if(!heard.length) return "";
  // Group by place
  const placeLbl={smiths:tr("🔨 Поселення ковалів","🔨 Smiths' settlement"),scholars:tr("📚 Караван науковців","📚 Scholars' caravan"),circus:tr("🎪 Бродячий цирк","🎪 Wandering circus")};
  const placeTotal={smiths:0,scholars:0,circus:0};
  TAVERN_RUMORS.forEach(r=>{placeTotal[r.place]=(placeTotal[r.place]||0)+1;});
  const byPlace={};
  heard.forEach(r=>{(byPlace[r.place]=byPlace[r.place]||[]).push(r);});
  const sections=Object.entries(byPlace).map(([place,rs])=>{
    const total=placeTotal[place]||rs.length;
    const items=rs.map(r=>{
      const text=lang==="en"?r.en:r.uk;
      const cityLbl=cityName(r.city);
      return `<div class="rumor-entry"><div class="rumor-text">${escapeHtml(text)}</div><div class="rumor-meta">📍 ${escapeHtml(cityLbl)} — ${escapeHtml(goodName(r.good))}</div></div>`;
    }).join("");
    return `<div class="rumor-section"><h4>${placeLbl[place]||place} (${rs.length}/${total})</h4>${items}</div>`;
  }).join("");
  return `<div class="rumor-panel"><h3>🍻 ${tr("Підказки таверн","Tavern rumours")}</h3>${sections}</div>`;
}
const giftSlots = {clothing:"Одяг",jewelry:"Прикраса",talisman:"Талісман",weapon:"Зброя",armor:"Броня"};
const itemRarities = {
  common:{name:"Звичайний",material:"дерево, каміння, вовна",colorClass:"common"},
  improved:{name:"Покращений",material:"залізо, мідь, олово",colorClass:"improved"},
  rare:{name:"Рідкісний",material:"срібло або золото",colorClass:"rare"},
  epic:{name:"Винятковий",material:"платина й коштовна інкрустація",colorClass:"epic"},
  legendary:{name:"Легендарний",material:"реліквія з власною історією",colorClass:"legendary"}
};
// To add an item, add one object here and place its PNG file at the matching img path.
const itemCatalog = [
  {id:"wool_cloak",rarity:"common",store:"worker",slot:"clothing",name:"Вовняний плащ",price:55,img:"assets/items/worker/wool_cloak.png",icon:"🧥",desc:"Теплий добротний одяг для щоденної роботи.",effects:{health:2,loyalty:1}},
  {id:"fine_outfit",rarity:"common",store:"worker",slot:"clothing",name:"Лляне святкове вбрання",price:95,img:"assets/items/worker/fine_outfit.png",icon:"👗",desc:"Охайний одяг, у якому приємно зустрічати гостей.",effects:{service:2,loyalty:2}},
  {id:"guild_ring",rarity:"improved",store:"worker",slot:"jewelry",name:"Мідний цеховий перстень",price:120,img:"assets/items/worker/guild_ring.png",icon:"💍",desc:"Нагадує про майстерність і статус.",effects:{craft:2,loyalty:2}},
  {id:"artisan_token",rarity:"improved",store:"worker",slot:"talisman",name:"Олов'яний знак ремісника",price:110,img:"assets/items/worker/artisan_token.png",icon:"🏅",desc:"Надихає на уважну ремісничу працю.",effects:{craft:2,service:2}},
  {id:"silver_brooch",rarity:"rare",store:"worker",slot:"jewelry",name:"Срібна брошка",price:185,img:"assets/items/worker/silver_brooch.png",icon:"💍",desc:"Вишуканий знак поваги до працівника.",effects:{loyalty:4,service:2}},
  {id:"golden_traveler_charm",rarity:"rare",store:"worker",slot:"talisman",name:"Золотий оберіг мандрівника",price:230,img:"assets/items/worker/golden_traveler_charm.png",icon:"🧿",desc:"Дорогий оберіг підтримує впевненість у далекій дорозі.",effects:{health:2,loyalty:4}},
  {id:"gold_inlaid_mantle",rarity:"epic",store:"worker",slot:"clothing",name:"Мантія із золотою інкрустацією",price:460,img:"assets/items/worker/gold_inlaid_mantle.png",icon:"👑",desc:"Рідкісний витвір придворної майстерні.",effects:{health:4,loyalty:5,service:3}},
  {id:"platinum_seal",rarity:"epic",store:"worker",slot:"talisman",name:"Платинова печатка з аметистом",price:520,img:"assets/items/worker/platinum_seal.png",icon:"💠",desc:"Коштовна річ, що засвідчує особливу довіру.",effects:{craft:4,loyalty:5,service:3}},
  {id:"traveler_charm",rarity:"common",store:"worker",slot:"talisman",name:"Кам'яний оберіг мандрівника",price:65,img:"assets/items/worker/traveler_charm.png",icon:"🧿",desc:"Простий оберіг підтримує дух у дорозі.",effects:{health:1,loyalty:2}},
  {id:"warm_tunic",rarity:"common",store:"support",slot:"clothing",name:"Тепла туніка",price:38,img:"assets/items/support/warm_tunic.png",icon:"🧥",desc:"Чистий теплий одяг покращує побут.",effects:{health:2,loyalty:2}},
  {id:"sturdy_boots",rarity:"common",store:"support",slot:"clothing",name:"Шкіряні черевики",price:42,img:"assets/items/support/sturdy_boots.png",icon:"👢",desc:"Захищають ноги під час роботи й дороги.",effects:{health:2,strength:1}},
  {id:"wooden_beads",rarity:"common",store:"support",slot:"jewelry",name:"Дерев'яне намисто",price:30,img:"assets/items/support/wooden_beads.png",icon:"📿",desc:"Невелика особиста річ, що повертає гідність.",effects:{loyalty:3}},
  {id:"family_ribbon",rarity:"common",store:"support",slot:"jewelry",name:"Пам'ятна стрічка",price:34,img:"assets/items/support/family_ribbon.png",icon:"🎗️",desc:"Нагадування про близьких і надію.",effects:{loyalty:3,health:1}},
  {id:"iron_clasp_coat",rarity:"improved",store:"support",slot:"clothing",name:"Плащ із залізними застібками",price:78,img:"assets/items/support/iron_clasp_coat.png",icon:"🧥",desc:"Міцний захист від вітру та дощу.",effects:{health:3,strength:2,loyalty:2}},
  {id:"protective_amulet",rarity:"improved",store:"support",slot:"talisman",name:"Мідний захисний оберіг",price:72,img:"assets/items/support/protective_amulet.png",icon:"🧿",desc:"Дає відчуття безпеки й спокою.",effects:{health:2,loyalty:3}},
  {id:"silver_memory_medallion",rarity:"rare",store:"support",slot:"jewelry",name:"Срібний медальйон пам'яті",price:168,img:"assets/items/support/silver_memory_medallion.png",icon:"📿",desc:"Особиста коштовність для збереження дорогого спогаду.",effects:{loyalty:5,health:2}},
  {id:"hope_token",rarity:"rare",store:"support",slot:"talisman",name:"Золотий жетон надії",price:195,img:"assets/items/support/hope_token.png",icon:"☀️",desc:"Цінний символ майбутньої свободи.",effects:{loyalty:6,health:2}},
  {id:"platinum_amulet",rarity:"epic",store:"support",slot:"talisman",name:"Платиновий оберіг з сапфіром",price:440,img:"assets/items/support/platinum_amulet.png",icon:"💠",desc:"Виняткова річ, яка дає сили пережити скрутні часи.",effects:{loyalty:7,health:5,strength:2}},
  {id:"velvet_gold_coat",rarity:"epic",store:"support",slot:"clothing",name:"Оксамитовий плащ із золотим шитвом",price:490,img:"assets/items/support/velvet_gold_coat.png",icon:"👘",desc:"Одяг надзвичайної якості, подарований як знак поваги.",effects:{health:5,loyalty:7,service:2}},
  {id:"mantle_of_yaroslav",rarity:"legendary",store:"any",slot:"clothing",name:"Мантія Ярославового посла",price:0,loot:true,img:"assets/items/legendary/mantle_of_yaroslav.png",icon:"🌟",desc:"Легендарна мантія, знайдена в дорозі.",lore:"Кажуть, її носив посол, який без війни примирив три князівства.",effects:{health:8,loyalty:9,service:7}},
  {id:"ring_of_the_last_forge",rarity:"legendary",store:"any",slot:"jewelry",name:"Перстень Останньої кузні",price:0,loot:true,img:"assets/items/legendary/ring_of_the_last_forge.png",icon:"🔥",desc:"Легендарний перстень, який пережив пожежу великої кузні.",lore:"Перекази стверджують, що його власник міг відчути тріщину в металі одним дотиком.",effects:{craft:10,loyalty:7,strength:5}},
  {id:"star_road_reliquary",rarity:"legendary",store:"any",slot:"talisman",name:"Релікварій Зоряного шляху",price:0,loot:true,img:"assets/items/legendary/star_road_reliquary.png",icon:"✨",desc:"Легендарний талісман мандрівників.",lore:"Його залишив караван, що повернувся додому після сорока років пошуків.",effects:{health:7,loyalty:10,service:6,craft:4}}
  ,{id:"iron_sword",rarity:"improved",store:"combat",slot:"weapon",name:"Кований залізний меч",price:0,loot:true,crafted:true,img:"assets/items/combat/iron_sword.png",icon:"⚔️",desc:"Зброя з кузні торгового дому. У звичайних крамницях не продається.",effects:{combat:3,strength:1}}
  ,{id:"iron_armor",rarity:"improved",store:"combat",slot:"armor",name:"Залізний панцир",price:0,loot:true,crafted:true,img:"assets/items/combat/iron_armor.png",icon:"🛡️",desc:"Обладунок, створений ковалем або здобутий у бою.",effects:{health:4,combat:1}}
  ,{id:"scholar_motion_talisman",rarity:"legendary",store:"any",slot:"talisman",name:"Астролябія Додаткового Ходу",price:0,loot:true,img:"assets/items/legendary/scholar_motion_talisman.png",icon:"🧭",desc:"Талісман каравану науковців. Дає +1 дію на день.",lore:"Його стрілка завжди показує не північ, а ще одну можливість.",effects:{health:3,service:4}}
  ,{id:"legendary_forge_blade",rarity:"legendary",store:"combat",slot:"weapon",name:"Клинок Таємного Горна",price:0,loot:true,img:"assets/items/legendary/legendary_forge_blade.png",icon:"🗡️",desc:"Легендарна зброя таємного поселення ковалів.",lore:"Клинок гуде, коли поруч брехня або слабкий метал.",effects:{combat:10,strength:6}}
  ,{id:"legendary_forge_armor",rarity:"legendary",store:"combat",slot:"armor",name:"Панцир Нічної Іскри",price:0,loot:true,img:"assets/items/legendary/legendary_forge_armor.png",icon:"🛡️",desc:"Легендарний обладунок голови ковальського поселення.",lore:"Його пластини темні, але кожен удар висікає синю іскру.",effects:{health:10,combat:5}}
  ,{id:"clown_cap",rarity:"legendary",store:"any",slot:"talisman",name:"Клоунський ковпак",price:0,loot:true,img:"assets/items/legendary/clown_cap.png",icon:"🎪",desc:"Дивний ковпак бродячого цирку. Разом із чоботами скорочує подорожі.",effects:{service:3,loyalty:2}}
  ,{id:"clown_boots",rarity:"legendary",store:"any",slot:"clothing",name:"Клоунські чоботи",price:0,loot:true,img:"assets/items/legendary/clown_boots.png",icon:"👢",desc:"Чоботи, у яких дорога ніби сама підстрибує під ногами.",effects:{health:3,strength:2}}
];
// Room furnishing objects: common and rare items are sold locally; legendary pieces are discovery-only.
const homeItemCatalog = [
  {id:"oak_bed",rarity:"common",slot:"bed",rooms:["house"],name:"Дубове ліжко",price:72,icon:"🛏️",img:"assets/items/home/oak_bed.png",desc:"Міцне ліжко для сімейного крила.",effects:{comfort:2}},
  {id:"wood_table",rarity:"common",slot:"table",rooms:["house","inn"],name:"Дерев'яний стіл",price:45,icon:"🪵",img:"assets/items/home/wood_table.png",desc:"Стіл для вечерь і розмов.",effects:{comfort:1,income:1}},
  {id:"clay_hearth",rarity:"common",slot:"hearth",rooms:["house"],name:"Глиняна піч",price:65,icon:"🔥",img:"assets/items/home/clay_hearth.png",desc:"Корисна лише на кухні дому.",effects:{upkeep:2}},
  {id:"storage_chest",rarity:"common",slot:"storage",rooms:["warehouse","house"],name:"Скриня з дощок",price:54,icon:"📦",img:"assets/items/home/storage_chest.png",desc:"Зберігає речі в порядку.",effects:{capacity:4}},
  {id:"forge_anvil",rarity:"common",slot:"tool",rooms:["forge"],name:"Залізне ковадло",price:105,icon:"🔨",img:"assets/items/home/forge_anvil.png",desc:"Основний інструмент коваля.",effects:{income:2,craft:1}},
  {id:"loom_frame",rarity:"common",slot:"loom",rooms:["weaving"],name:"Дерев'яний верстат",price:98,icon:"🧵",img:"assets/items/home/loom_frame.png",desc:"Дозволяє ткачеві працювати зручніше.",effects:{income:2,craft:1}},
  {id:"iron_locks",rarity:"common",slot:"security",rooms:["cells","warehouse"],name:"Залізні замки",price:80,icon:"🔐",img:"assets/items/home/iron_locks.png",desc:"Зміцнює двері й порядок.",effects:{security:2}},
  {id:"hay_manger",rarity:"common",slot:"stable",rooms:["stable"],name:"Ясла для коней",price:62,icon:"🌾",img:"assets/items/home/hay_manger.png",desc:"Добрий догляд за кіньми.",effects:{routeSafety:1,income:1}},
  {id:"jeweler_lamp",rarity:"common",slot:"light",rooms:["jewelry"],name:"Лампа ювеліра",price:120,icon:"🕯️",img:"assets/items/home/jeweler_lamp.png",desc:"Яскраве світло для тонкої роботи з металом і склом.",effects:{income:3,craft:1}},
  {id:"carpenters_bench",rarity:"common",slot:"tool",rooms:["furniture"],name:"Столярний верстак",price:110,icon:"🪚",img:"assets/items/home/carpenters_bench.png",desc:"Міцний верстак для виготовлення меблів.",effects:{income:3,craft:1}},
  {id:"silver_candlestand",rarity:"rare",slot:"light",rooms:["house","inn"],name:"Срібний підсвічник",price:215,icon:"🕯️",img:"assets/items/home/silver_candlestand.png",desc:"Освітлює покої та справляє враження на гостей.",effects:{comfort:4,income:3}},
  {id:"master_toolrack",rarity:"rare",slot:"tool",rooms:["forge"],name:"Срібно оздоблений набір коваля",price:310,icon:"⚒️",img:"assets/items/home/master_toolrack.png",desc:"Інструменти для вправного майстра.",effects:{income:7,craft:3}},
  {id:"dyed_master_loom",rarity:"rare",slot:"loom",rooms:["weaving"],name:"Верстат із синім різьбленням",price:295,icon:"🪡",img:"assets/items/home/dyed_master_loom.png",desc:"Рідкісний верстат для тонких тканин.",effects:{income:7,craft:3}},
  {id:"captains_saddle",rarity:"rare",slot:"stable",rooms:["stable"],name:"Срібна похідна упряж",price:280,icon:"🐎",img:"assets/items/home/captains_saddle.png",desc:"Полегшує тривалі караванні переходи.",effects:{routeSafety:4,income:4}},
  {id:"gem_cutters_table",rarity:"rare",slot:"tool",rooms:["jewelry"],name:"Стіл огранювача",price:330,icon:"💎",img:"assets/items/home/gem_cutters_table.png",desc:"Точне місце для дорогої ювелірної роботи.",effects:{income:7,craft:3}},
  {id:"walnut_pattern_table",rarity:"rare",slot:"table",rooms:["furniture"],name:"Горіховий стіл лекал",price:300,icon:"🪵",img:"assets/items/home/walnut_pattern_table.png",desc:"Зразки й лекала для меблів кращої якості.",effects:{income:7,craft:3}},
  {id:"table_of_concord",rarity:"legendary",slot:"table",rooms:["house","inn"],name:"Стіл Великої Угоди",price:0,loot:true,icon:"✨",img:"assets/items/home/table_of_concord.png",desc:"Стіл, за яким укладали мир між містами.",lore:"Його поверхня зберігає зарубки печаток давніх послів.",effects:{comfort:10,income:12}},
  {id:"anvil_of_red_dawn",rarity:"legendary",slot:"tool",rooms:["forge"],name:"Ковадло Червоної Зорі",price:0,loot:true,icon:"🔥",img:"assets/items/home/anvil_of_red_dawn.png",desc:"Легендарне ковадло мандрівного зброяра.",lore:"Подейкують, на ньому було викувано обладунок, що врятував короля.",effects:{income:15,craft:7}},
  {id:"loom_of_silk_road",rarity:"legendary",slot:"loom",rooms:["weaving"],name:"Верстат Шовкового Шляху",price:0,loot:true,icon:"🌟",img:"assets/items/home/loom_of_silk_road.png",desc:"Легендарний ткацький верстат.",lore:"Його нитки нібито пам'ятають узори Константинополя.",effects:{income:15,craft:7}}
];

let gold, food, day, reputation, cityReputations, reputationCalmDays, currentCity, npcId, currentRoom, selectedProfileId, profileReturnTab;
let selectedTravelDestination = null;
let selectedTravelCompanions = [];
let travelCompanionIds = [];
let selectedBattleMode = "auto";
let manualCombatState = null;
let inventory, itemInventory, markets, npcMarket, ownedSlaves, ownedHirelings, activeCaravans, rooms, journal;
let securityUntil, caravanBoostUntil, kitchenUntil, roomActionsUsed, caravanId, guildBoards, councilBoards, guildQuestId;
let player, energy, daySummary, homeInventory, achievements, visitedCities, shopStock;
let activeTab = "market";

// === v0.43: i18n helpers for new strings ===
function tr(uk,en){return lang==="en"?en:uk;}

// === v0.43: Seasons ===
const SEASONS=[
  {key:"spring",name:"Весна",nameEn:"Spring",icon:"🌱",
    mods:{"Зерно":1.20,"Льон":1.20,"Хутро":0.85,"Дрова":0.85,"Сіль":0.95}},
  {key:"summer",name:"Літо",nameEn:"Summer",icon:"☀️",
    mods:{"Риба":1.20,"Вино":1.15,"Мед":1.15,"Хутро":0.75,"Зерно":0.85}},
  {key:"autumn",name:"Осінь",nameEn:"Autumn",icon:"🍂",
    mods:{"Шкіра":1.20,"Шовк":1.15,"Прянощі":1.20,"Вино":1.10,"Хутро":0.95}},
  {key:"winter",name:"Зима",nameEn:"Winter",icon:"❄️",
    mods:{"Хутро":1.35,"Дрова":1.30,"Сіль":1.20,"Вовна":1.20,"Риба":0.85,"Зерно":0.90,"Льон":0.85}}
];
function currentSeason(){return SEASONS[Math.floor(((day-1)%120)/30)];}
function seasonModifier(goodName){return currentSeason().mods[goodName]||1;}
function seasonHeaderHtml(){
  const s=currentSeason();
  const left=30-((day-1)%30);
  const name=lang==="en"?s.nameEn:s.name;
  const suffix=lang==="en"?"d left":"дн.";
  return `<span class="season-badge season-${s.key}" title="${s.icon} ${name}: ${left}${suffix}">${s.icon} ${name} • ${left}${suffix}</span>`;
}

function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function pick(values){return values[rand(0,values.length-1)];}
function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
}
function cleanText(value,fallback="",maxLength=240){
  const result=String(value??fallback).replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim();
  return (result||fallback).slice(0,maxLength);
}
function integerInRange(value,fallback,min,max){
  return Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
}
function validCityIndex(value,fallback=0){return integerInRange(value,fallback,0,cities.length-1);}
function safeStoredText(value,fallback,maxLength){return cleanText(value,fallback,maxLength);}
function roomByKey(key){return rooms.find(r=>r.key===key);}
function ownedPeople(){return ownedSlaves.concat(ownedHirelings);}
function cityReputation(index=currentCity){
  return cityReputations&&Number.isInteger(cityReputations[index])?cityReputations[index]:0;
}
function setCityReputation(index,value){
  if(!cityReputations) cityReputations=cities.map(()=>0);
  cityReputations[index]=integerInRange(value,0,-100000,100000);
  reputation=cityReputation(currentCity);
}
function adjustReputation(delta,index=currentCity){
  const cityIndex=validCityIndex(index,currentCity);
  setCityReputation(cityIndex,cityReputation(cityIndex)+delta);
  if(delta<0 && reputationCalmDays) reputationCalmDays[cityIndex]=0;
}
function reputationPriceMultiplier(index=currentCity){
  const value=cityReputation(index);
  if(value<=-10) return 2.5;
  if(value<0) return 1.5;
  return 1;
}
function badReputationFear(index=currentCity){return cityReputation(index)<0;}
function badReputationStrong(index=currentCity){return cityReputation(index)<=-10;}
function reputationLabel(index=currentCity){
  const value=cityReputation(index);
  const price=reputationPriceMultiplier(index);
  if(lang==="en"){
    if(value<=-10) return `Reputation: ${value}. The city fears you: prices x${price}, the roads barely touch you.`;
    if(value<0) return `Reputation: ${value}. Ill fame: prices x${price}, bandits hesitate to attack.`;
    return `Reputation: ${value}. Good fame raises your selling price.`;
  }
  if(value<=-10) return `Репутація: ${value}. Місто боїться тебе: ціни x${price}, дороги майже не чіпають.`;
  if(value<0) return `Репутація: ${value}. Погана слава: ціни x${price}, розбійники вагаються нападати.`;
  return `Репутація: ${value}. Добра слава підвищує ціну продажу.`;
}
function namePairText(pair,index){return Array.isArray(pair)?(pair[index]||pair[0]):pair;}
function regionalNamePool(cityIndex){
  const city=cities[validCityIndex(cityIndex,0)];
  return regionalNpcNames[city.region]||regionalNpcNames.default;
}
function pickRegionalPair(cityIndex,kind){
  const pool=regionalNamePool(cityIndex);
  return pick((pool&&pool[kind])||(regionalNpcNames.default[kind]));
}
function randomNpcIdentity(gender,cityIndex){
  const first=pickRegionalPair(cityIndex,gender);
  const surname=pickRegionalPair(cityIndex,"surnames");
  return {name:namePairText(first,0),nameEn:namePairText(first,1),surname:namePairText(surname,0),surnameEn:namePairText(surname,1)};
}
function allRegionalNames(gender){
  const names=[];
  Object.values(regionalNpcNames).forEach(pool=>(pool[gender]||[]).forEach(pair=>{
    names.push(namePairText(pair,0),namePairText(pair,1));
  }));
  return names;
}
function achievementUnlocked(id){return Boolean(achievements && achievements[id]);}
function unlockAchievement(id){
  const achievement=achievementCatalog.find(entry=>entry.id===id);
  if(!achievement || achievementUnlocked(id)) return;
  achievements[id]={day,title:achievement.title};
  log("🏆 "+tr("Досягнення отримано","Achievement unlocked")+": "+achievementTitle(achievement)+". "+achievementDesc(achievement),"achievement",true);
  // v0.43: tell CrazyGames this is a happy moment (good for share prompts)
  CG.happytime();
}
function checkLevelAchievements(){
  for(let level=1;level<=playerLevel();level++) unlockAchievement("level_"+level);
}
function checkRoomAchievements(){
  if(rooms && rooms.length && rooms.every(room=>room.unlocked)) unlockAchievement("all_rooms");
}
function markVisitedCity(index){
  if(!Array.isArray(visitedCities)) visitedCities=[];
  if(!visitedCities.includes(index)) visitedCities.push(index);
  if(visitedCities.length>=cities.length) unlockAchievement("all_cities");
}
function legendaryItemIds(){
  return itemCatalog.concat(homeItemCatalog).filter(item=>item.loot && item.rarity==="legendary").map(item=>item.id);
}
function hasLegendaryItem(id){
  return itemStock(id)>0 || homeStock(id)>0 || ownedPeople().some(person=>Object.values(person.equipment||{}).includes(id) || (person.privateFurnishings||[]).includes(id)) || rooms.some(room=>(room.furnishings||[]).includes(id));
}
function checkLegendaryAchievements(){
  const ids=legendaryItemIds();
  if(ids.length && ids.every(hasLegendaryItem)) unlockAchievement("all_legendaries");
}
function playerLevel(){
  const xp=player&&Number.isInteger(player.xp)?player.xp:0;
  let level=1;
  playerRanks.forEach((rank,index)=>{if(xp>=rank.xp) level=index+1;});
  return level;
}
function rankInfo(){return playerRanks[playerLevel()-1];}
function rankName(rank){return loc("ranks",(rank&&rank.name)||rank);}
function nextRankInfo(){return playerRanks[playerLevel()]||null;}
function gainExperience(amount,reason){
  if(!player || amount<1) return;
  const before=playerLevel();
  player.xp=(player.xp||0)+amount;
  const after=playerLevel();
  log("⭐ "+tr("Досвід героя","Hero XP")+": +"+amount+(reason?(tr(" за "," for ")+reason):"")+".","system");
  if(after>before){
    log("🏅 "+tr("Новий рівень ","New level ")+after+": "+rankName(rankInfo())+". "+tr("У гільдії відкриваються складніші контракти.","Harder contracts open up in the guild."),"quest");
    for(let level=before+1;level<=after;level++) unlockAchievement("level_"+level);
    refreshAvailableQuestBoards();
  }
}
function hasHeadquarters(){return player && Number.isInteger(player.headquartersCity);}
function atHeadquarters(){return hasHeadquarters() && currentCity===player.headquartersCity;}
function requireCurrentNpc(person){
  if(person && person.locationCity===currentCity) return true;
  log("❌ Ця людина перебуває не в місті, де знаходиться головний герой.","system");
  render();
  return false;
}
function requireHeadquartersPresence(){
  if(atHeadquarters()) return true;
  const location=hasHeadquarters()?cities[player.headquartersCity].name:"ще не засновано";
  log("❌ Для цієї дії потрібно перебувати у місті штабу. Розташування штабу: "+location+".","system");
  render();
  return false;
}
function inferGender(name){
  const value=String(name||"");
  if(npcNames.female.includes(value) || allRegionalNames("female").includes(value)) return "female";
  if(npcNames.male.includes(value) || allRegionalNames("male").includes(value)) return "male";
  return /а$|я$|ія$|на$|та$|да$/i.test(value)?"female":"male";
}
function safePortraitSet(value,gender){
  return /^[a-z0-9_-]+$/i.test(value||"")?value:pick(npcPortraitSets[gender]);
}
function safeAssetPath(value){
  return /^assets\/[a-z0-9_/-]+\.png$/i.test(value||"")?value:null;
}

function normalizeRoomDefinitions(list){
  const rooms=list.map(room=>room.key==="house"?{
    ...room,
    freeRooms:2,
    maxFreeRooms:BALANCE.maxHouseRooms
  }:room.key==="stable"?{
    ...room,
    icon:"🌾",
    name:"Ферма",
    image:"farm",
    stat:"Їжа",
    job:"Ферма",
    desc:"Господарський двір для коней, курей, свиней, корів та овець. Призначений фермер доглядає тварин, отримує їжу і допомагає караванам.",
    action:"Заготувати корм і їжу",
    effect:"Ферма дає їжу для рабів, підтримує тварин і все ще знижує ризик караванів завдяки коням.",
    allowedSlots:["stable","storage","light","table"]
  }:room);
  const insertBeforeCells=rooms.findIndex(room=>room.key==="cells");
  const extra=[
    {key:"jewelry",icon:"💍",name:"Ювелірна майстерня",level:1,unlocked:false,buildCost:420,image:"jewelry",stat:"Тонка робота",bonus:1,job:"Ювелірна майстерня",skill:"craft",desc:"Майстерня для срібла, скла та коштовних прикрас. Ювелір перетворює дорогі ресурси на цінний товар.",action:"Виготовити прикраси",effect:"Ювелір із ремеслом створює прикраси та приносить високий пасивний дохід.",cost:24,allowedSlots:["tool","storage","light","table"],furnishings:[]},
    {key:"furniture",icon:"🪑",name:"Меблева майстерня",level:1,unlocked:false,buildCost:340,image:"furniture",stat:"Столярство",bonus:1,job:"Меблева майстерня",skill:"craft",desc:"Приміщення для виготовлення столів, скринь, ліжок і речей для дому. Столяр робить товар із дерева, шкіри та інструментів.",action:"Виготовити меблі",effect:"Мебляр створює меблі для продажу і підтримує облаштування штабу.",cost:20,allowedSlots:["tool","storage","light","table"],furnishings:[]}
  ];
  extra.forEach(room=>{
    if(!rooms.some(existing=>existing.key===room.key)){
      const index=insertBeforeCells>=0?insertBeforeCells:rooms.length;
      rooms.splice(index,0,room);
    }
  });
  return rooms.filter(room=>room.key!=="cells").concat(rooms.filter(room=>room.key==="cells"));
}
function makeRooms(){
  return normalizeRoomDefinitions([
    {key:"house",icon:"🏠",name:"Дім торговця",level:1,unlocked:true,buildCost:0,image:"merchant_house",stat:"Затишок",bonus:1,job:"Кухня",skill:"craft",desc:"Серце торгового дому: тут герой живе, приймає близьких і поступово відновлює сімейний побут.",action:"Приготувати пайки",effect:"Відновлена кухня з кухарем знижує утримання і приносить малий дохід.",cost:12,kitchenRestored:false,familyWingRestored:false,allowedSlots:["bed","table","hearth","light","storage"],furnishings:[]},
    {key:"warehouse",icon:"📦",name:"Склад",level:1,unlocked:false,buildCost:180,image:"warehouse",stat:"Місткість",bonus:20,job:"Склад",skill:"strength",desc:"Захищене приміщення для торгових запасів. Відкриття складу суттєво розширює інвентар.",action:"Посилити охорону",effect:"Комірники збільшують місткість; охорона знижує збитки.",cost:18,allowedSlots:["storage","security","light","table"],furnishings:[]},
    {key:"forge",icon:"🔨",name:"Кузня",level:1,unlocked:false,buildCost:300,image:"forge",stat:"Ремесло",bonus:1,job:"Кузня",skill:"craft",desc:"Майстерня для обробки металу. Лише призначений коваль може кувати інструменти, зброю й обладунки.",action:"Викувати інструменти",effect:"Ремесло коваля і обладнання визначають дохід та якість виробництва.",cost:18,allowedSlots:["tool","hearth","storage","light","table"],furnishings:[]},
    {key:"weaving",icon:"🧵",name:"Ткацький цех",level:1,unlocked:false,buildCost:260,image:"weaving",stat:"Ремесло",bonus:1,job:"Ткацький цех",skill:"craft",desc:"Робочий цех тканин і шкіри. Ткач виробляє килими, одяг, сумки та шапки.",action:"Виткати килим",effect:"Без ткача цех мовчить; верстат і ремесло підвищують прибуток.",cost:14,allowedSlots:["loom","storage","light","table"],furnishings:[]},
    {key:"cells",icon:"🔒",name:"Камери",level:1,unlocked:false,buildCost:210,image:"cells",stat:"Контроль",bonus:1,job:"Камера",skill:"obedience",desc:"Закрите приміщення для NPC, яких власник вважає небезпечними або непокірними.",action:"Провести огляд",effect:"Утримувані в камері набувають покірності, але втрачають лояльність.",cost:10,allowedSlots:["security","light","table","storage"],furnishings:[]},
    {key:"stable",icon:"🐎",name:"Стайня",level:1,unlocked:false,buildCost:280,image:"stable",stat:"Швидкість",bonus:1,job:"Стайня",skill:"strength",desc:"Місце для коней, упряжі й підготовки перевезень. Сила конюха допомагає караванам.",action:"Підготувати коней",effect:"Працівник стайні дає дохід і знижує ризик на шляхах.",cost:28,allowedSlots:["stable","storage","light","table"],furnishings:[]},
    {key:"inn",icon:"🍺",name:"Таверна",level:1,unlocked:false,buildCost:360,image:"tavern",stat:"Гостинність",bonus:1,job:"Заїжджий двір",skill:"service",desc:"Зала для гостей і мандрівників. Згодом тут можна буде збирати чутки та замовлення.",action:"Влаштувати вечерю",effect:"Вільний працівник із гостинністю перетворює відвідувачів на прибуток.",cost:26,allowedSlots:["table","light","storage","hearth"],furnishings:[]},
    {key:"training",icon:"⚔️",name:"Тренувальна зала",level:1,unlocked:false,buildCost:240,image:"training",stat:"Підготовка",bonus:1,job:"Тренування",skill:"combat",desc:"Майданчик для вправ зі зброєю та підготовки охорони торгового дому.",action:"Провести тренування",effect:"Навичка бою зростає і допомагає захищати каравани.",cost:22,allowedSlots:["tool","storage","light","table"],furnishings:[]}
  ]);
}
function migrateRooms(savedRooms){
  const legacyBuiltState=Boolean((savedRooms||[]).length && !(savedRooms||[]).some(room=>Object.prototype.hasOwnProperty.call(room,"unlocked")));
  return makeRooms().map(room=>{
    const previous=(savedRooms||[]).find(candidate=>candidate.key===room.key);
    if(room.key==="house" && !previous && legacyBuiltState){
      return {...room,kitchenRestored:Boolean((savedRooms||[]).find(candidate=>candidate.key==="kitchen")),familyWingRestored:Boolean((savedRooms||[]).find(candidate=>candidate.key==="living"))};
    }
    if(!previous) return room;
    const unlocked=room.key==="house"?true:legacyBuiltState?true:Boolean(previous.unlocked);
    return {...room,level:integerInRange(previous.level,1,1,100),unlocked,kitchenRestored:Boolean(previous.kitchenRestored),familyWingRestored:Boolean(previous.familyWingRestored),freeRooms:integerInRange(previous.freeRooms,room.freeRooms||2,0,BALANCE.maxHouseRooms),furnishings:Array.isArray(previous.furnishings)?previous.furnishings.filter(id=>validHomeItemIds().has(id)).slice(0,5):[]};
  });
}

function makeNPC(status,cityIndex,overrides){
  const role = pick(status==="slave"?slaveRoles:freeRoles);
  const trait = pick(npcTraits);
  const gender = overrides&&overrides.gender?overrides.gender:overrides&&overrides.name?inferGender(overrides.name):pick(["male","female"]);
  const identity=randomNpcIdentity(gender,cityIndex);
  const portraitPool=status==="slave"
    ? (gender==="male"?["male_slave_01","male_slave_02","male_slave_03","male_slave_04","male_slave_05"]:["female_slave_01","female_slave_02","female_slave_03","female_slave_04","female_slave_05"])
    : npcPortraitSets[gender];
  const person = {
    id:npcId++,
    name:identity.name,
    nameEn:identity.nameEn,
    surname:identity.surname,
    surnameEn:identity.surnameEn,
    nickname:"",
    gender,
    portraitSet:pick(portraitPool),
    status,
    profession:role.profession,
    price:role.price+rand(-8,12),
    img:role.img,
    city:cityIndex,
    locationCity:cityIndex,
    homeCity:cities[cityIndex].name,
    age:rand(18,56),
    trait:{...trait},
    story:pick(npcHistories),
    hope:pick(npcHopes),
    likes:pick(npcLikes),
    dislikes:pick(npcDislikes),
    familyStatus:pick(npcFamilyStatuses),
    equipment:{clothing:null,jewelry:null,talisman:null,weapon:null,armor:null},
    equipmentApplied:{clothing:{},jewelry:{},talisman:{},weapon:{},armor:{}},
    bond:rand(4,14),
    affection:rand(2,12),
    trust:rand(2,12),
    love:0,
    interactionDays:{},
    cherishedGiftIds:[],
    spouse:false,
    privateRoom:false,
    privateFurnishings:[],
    pregnantUntil:null,
    childOf:null,
    childGrowth:0,
    ageProgress:0,
    longLived:false,
    daysTogether:0,
    earningsTotal:0,
    earningsDays:0,
    lastIncome:0,
    goodsProduced:0,
    unpaidDays:0,
    starvingDays:0,
    strength:rand(2,10),
    craft:rand(1,10),
    combat:rand(1,10),
    service:rand(1,10),
    loyalty:rand(1,10),
    obedience:rand(1,10),
    health:rand(6,10),
    job:"Без роботи"
  };
  Object.assign(person,overrides||{});
  person.gender=person.gender||inferGender(person.name);
  person.portraitSet=safePortraitSet(person.portraitSet,person.gender);
  if(!person.nameEn) person.nameEn=person.name;
  if(!person.surnameEn) person.surnameEn=person.surname;
  person.value=person.price;
  if(person.trait.stat) person[person.trait.stat]=clamp(person[person.trait.stat]+person.trait.bonus,0,BALANCE.maxAttribute);
  return person;
}
function enrichNPC(person,fallbackCity){
  const trait=person.trait||{...pick(npcTraits)};
  person.id=integerInRange(person.id,npcId++,1,100000000);
  person.gender=["male","female"].includes(person.gender)?person.gender:inferGender(person.name);
  person.portraitSet=safePortraitSet(person.portraitSet,person.gender);
  const fallbackIdentity=randomNpcIdentity(person.gender,validCityIndex(person.city,fallbackCity));
  person.name=safeStoredText(person.name,fallbackIdentity.name,34);
  person.nameEn=safeStoredText(person.nameEn||"", person.name===fallbackIdentity.name?fallbackIdentity.nameEn:person.name,34);
  person.surname=safeStoredText(person.surname,fallbackIdentity.surname,34);
  person.surnameEn=safeStoredText(person.surnameEn||"", person.surname===fallbackIdentity.surname?fallbackIdentity.surnameEn:person.surname,34);
  person.nickname=safeStoredText(person.nickname||"", "",34);
  person.status=["slave","serf","citizen","free","child"].includes(person.status)?person.status:"free";
  person.city=validCityIndex(person.city,fallbackCity);
  person.locationCity=validCityIndex(person.locationCity,fallbackCity);
  person.homeCity=safeStoredText(person.homeCity,cities[person.city].name,60);
  person.age=integerInRange(person.age,rand(18,56),0,120);
  person.price=integerInRange(person.price,0,0,10000000);
  person.value=integerInRange(person.value,person.price,0,10000000);
  person.profession=safeStoredText(person.profession,"Працівник",50);
  person.job=person.job==="Стайня"?"Ферма":person.job;
  person.job=["Без роботи","Зростає в родині","Склад","Тренування","Ткацький цех","Кузня","Ферма","Кухня","Заїжджий двір","Камера","Ювелірна майстерня","Меблева майстерня"].includes(person.job)?person.job:"Без роботи";
  person.img=safeAssetPath(person.img);
  person.trait={...trait,name:safeStoredText(trait.name,"Обережний",40),effect:safeStoredText(trait.effect,"",55),description:safeStoredText(trait.description,"",180)};
  person.story=safeStoredText(person.story,pick(npcHistories),260);
  person.hope=safeStoredText(person.hope,pick(npcHopes),150);
  person.likes=safeStoredText(person.likes,pick(npcLikes),100);
  person.dislikes=safeStoredText(person.dislikes,pick(npcDislikes),100);
  person.familyStatus=safeStoredText(person.familyStatus,pick(npcFamilyStatuses),100);
  person.equipment=person.equipment||{clothing:null,jewelry:null,talisman:null};
  person.equipmentApplied=person.equipmentApplied||{clothing:{},jewelry:{},talisman:{}};
  Object.keys(giftSlots).forEach(slot=>{if(!(slot in person.equipment)) person.equipment[slot]=null;});
  Object.keys(giftSlots).forEach(slot=>{if(!validItemIds().has(person.equipment[slot])) person.equipment[slot]=null;});
  Object.keys(giftSlots).forEach(slot=>{if(!(slot in person.equipmentApplied)) person.equipmentApplied[slot]={};});
  person.daysTogether=integerInRange(person.daysTogether,0,0,999999);
  person.earningsTotal=integerInRange(person.earningsTotal,0,0,100000000);
  person.earningsDays=integerInRange(person.earningsDays,0,0,999999);
  person.lastIncome=integerInRange(person.lastIncome,0,0,100000000);
  person.goodsProduced=integerInRange(person.goodsProduced,0,0,100000000);
  person.unpaidDays=integerInRange(person.unpaidDays,0,0,999999);
  person.starvingDays=integerInRange(person.starvingDays,0,0,999999);
  ["strength","craft","combat","service","loyalty","obedience","health"].forEach(stat=>{
    person[stat]=integerInRange(person[stat],rand(1,10),0,BALANCE.maxAttribute);
  });
  person.mastery=person.mastery==="Стайня"?"Ферма":person.mastery;
  person.mastery=["Склад","Тренування","Ткацький цех","Кузня","Ферма","Кухня","Заїжджий двір","Ювелірна майстерня","Меблева майстерня"].includes(person.mastery)?person.mastery:null;
  person.bond=integerInRange(person.bond,rand(4,14),0,100);
  person.affection=integerInRange(person.affection,rand(2,12),0,100);
  person.trust=integerInRange(person.trust,rand(2,12),0,100);
  person.love=integerInRange(person.love,0,0,100);
  person.interactionDays=person.interactionDays||{};
  person.cherishedGiftIds=person.cherishedGiftIds||[];
  person.spouse=Boolean(person.spouse);
  person.privateRoom=Boolean(person.privateRoom);
  person.privateFurnishings=Array.isArray(person.privateFurnishings)?person.privateFurnishings.filter(id=>validHomeItemIds().has(id)).slice(0,5):[];
  person.pregnantUntil=Number.isInteger(person.pregnantUntil)?person.pregnantUntil:null;
  person.childOf=person.childOf||null;
  person.childGrowth=integerInRange(person.childGrowth,0,0,20);
  person.ageProgress=integerInRange(person.ageProgress,0,0,20);
  if(person.childOf && typeof person.childOf==="object"){
    person.childOf={...person.childOf,motherName:safeStoredText(person.childOf.motherName,"мати",70)};
  }else{
    person.childOf=null;
  }
  person.longLived=Boolean(person.longLived || person.age>BALANCE.immortalAge);
  return person;
}
function displayFirstName(person){return lang==="en" && person.nameEn?person.nameEn:person.name;}
function displaySurname(person){return lang==="en" && person.surnameEn?person.surnameEn:person.surname;}
function profileName(person){return displayFirstName(person)+(person.nickname?` «${person.nickname}»`:"")+" "+displaySurname(person);}
function htmlName(person){return escapeHtml(profileName(person));}
function promptClean(message,current,maxLength){
  if(!window.prompt) return null;
  const value=window.prompt(message,current||"");
  if(value===null) return null;
  return cleanText(value,current||"",maxLength);
}
function compensationText(person){
  if(person.status==="slave") return tr("Харчування","Food")+": "+BALANCE.slaveFoodPerDay+" "+tr("їжі / день","food / day");
  const salary=monthlyPayrollAmount(person);
  if(salary>0) return tr("Зарплатня","Salary")+": "+salary+" "+tr("монет / місяць","coins / month");
  return tr("Зарплатня не нараховується","No salary");
}
function compensationDetail(person){
  if(person.status==="slave") return tr(
    `Раб не отримує платню. Потрібно <b>${BALANCE.slaveFoodPerDay}</b> їжі щодня. Якщо їжі бракує, падають здоров'я, лояльність і покірність.`,
    `A slave receives no salary. They need <b>${BALANCE.slaveFoodPerDay}</b> food per day. If food runs out, health, loyalty and obedience drop.`
  );
  const salary=monthlyPayrollAmount(person);
  return salary>0
    ? tr(`Місячна платня: <b>${salary}</b> монет. Списується кожні 30 днів разом із платнею інших підлеглих.`,`Monthly salary: <b>${salary}</b> coins. Deducted every 30 days along with other retainers' pay.`)
    : tr("Платня не нараховується.","No salary is paid.");
}
function portraitMasterKey(job){
  return {"Кузня":"forge","Ткацький цех":"weaving","Ферма":"farm","Кухня":"kitchen","Заїжджий двір":"inn","Склад":"warehouse","Тренування":"guard","Ювелірна майстерня":"jeweler","Меблева майстерня":"furniture"}[job]||"worker";
}
// v0.43: Women portraits from 5-panel image
const WOMEN_PANEL_SETS=["female_01","female_02","female_03","female_04","female_05"];
function getWomenPanelIndex(person){
  if(!person||person.status==="slave"||person.gender!=="female") return -1;
  const idx=WOMEN_PANEL_SETS.indexOf(person.portraitSet);
  return idx;
}
function portraitHtml(person,cls){
  const idx=getWomenPanelIndex(person);
  if(idx>=0){
    const pct=(idx/(WOMEN_PANEL_SETS.length-1))*100;
    return `<div class="women-panel-portrait ${cls||""}" style="background-position-x:${pct}%"></div>`;
  }
  const paths=portraitPaths(person);
  const portrait=paths.shift();
  return `<img class="${cls||""}" src="${portrait}" data-fallbacks="${paths.join("|")}" data-icon="${person.status==="slave"?"⛓️":"🧍"}" onerror="nextPortrait(this)">`;
}

function portraitPaths(person){
  const set=person.status==="serf" && person.gender==="female" && !String(person.portraitSet||"").startsWith("female_serf_")
    ? "female_serf_"+String((person.id%5)+1).padStart(2,"0")
    : person.portraitSet;
  const root="assets/npc/"+set+"/";
  const stage=person.mastery?"master_"+portraitMasterKey(person.mastery):person.status==="free"?"free":person.status;
  const paths=[root+stage+".png"];
  if(person.mastery) paths.push(root+"citizen.png");
  if(stage!=="free") paths.push(root+"free.png");
  if(person.img) paths.push(person.img);
  return paths;
}
function fullPortraitPaths(person){
  const regular=portraitPaths(person);
  const full=regular.filter(path=>path.startsWith("assets/npc/")).map(path=>path.replace(/\/([^/]+)\.png$/,"/full_$1.png"));
  return full.concat(regular);
}
function nextPortrait(image){
  const paths=image.dataset.fallbacks?image.dataset.fallbacks.split("|"):[];
  if(paths.length){
    image.dataset.fallbacks=paths.slice(1).join("|");
    image.src=paths[0];
    return;
  }
  image.remove();
  image.parentElement.innerHTML=image.dataset.icon;
}
function statusLabel(person){
  const ua={slave:"Раб",serf:"Кріпак",citizen:"Вільний громадянин",free:"Найманець",child:"Дитина родини"}[person.status]||"Працівник";
  return loc("statuses",ua);
}
function jobTitle(job,master){
  const titles={
    "Кузня":master?"Майстер-коваль":"Коваль",
    "Ткацький цех":master?"Майстер-ткач":"Ткач",
    "Ферма":master?"Майстер-фермер":"Фермер",
    "Ювелірна майстерня":master?"Майстер-ювелір":"Ювелір",
    "Меблева майстерня":master?"Майстер-столяр":"Столяр",
    "Кухня":master?"Майстер-кухар":"Кухар",
    "Заїжджий двір":master?"Майстер-корчмар":"Корчмар",
    "Склад":master?"Майстер-комірник":"Комірник",
    "Тренування":master?"Майстер-зброяр":"Охоронець"
  };
  const ua=titles[job];
  return ua?loc("jobTitles",ua):null;
}
function roomForJob(job){return rooms.find(room=>room.job===(job==="Стайня"?"Ферма":job));}
function jobIsAvailable(job){
  const room=roomForJob(job);
  return Boolean(room && room.unlocked && (job!=="Кухня" || room.kitchenRestored));
}
function assignedStaff(job){
  const normalized=job==="Стайня"?"Ферма":job;
  return jobIsAvailable(normalized)?ownedPeople().filter(person=>(person.job==="Стайня"?"Ферма":person.job)===normalized && (!hasHeadquarters() || person.locationCity===player.headquartersCity) && (normalized!=="Заїжджий двір" || person.status!=="slave")):[];
}
function jobSkill(person){
  const skill={"Склад":"strength","Тренування":"combat","Ткацький цех":"craft","Кузня":"craft","Ферма":"strength","Стайня":"strength","Кухня":"craft","Заїжджий двір":"service","Ювелірна майстерня":"craft","Меблева майстерня":"craft"}[person.job];
  return skill?person[skill]:0;
}
function skillLabel(skill){
  const ua={strength:"сила",craft:"ремесло",combat:"бій",service:"гостинність",obedience:"покірність",loyalty:"лояльність"}[skill]||skill;
  return loc("skills",ua);
}
function relationshipRank(person){return clamp(Math.ceil((person.bond||1)/10),1,10);}
function relationshipLabel(person){
  if(person.spouse) return lang==="en"?"Spouse":"Подружжя";
  if(person.childOf && relationshipRank(person)===10) return lang==="en"?"Own child":"Рідна дитина";
  return loc("relationships",relationshipRanks[relationshipRank(person)-1]);
}
function isAdult(person){return person.status!=="child" && person.age>=18;}
function isFreeAdult(person){return isAdult(person) && (person.status==="free" || person.status==="citizen");}
function romanticEligible(person){return isFreeAdult(person) && !person.childOf;}
function consumeAction(label){
  if(energy<1){
    log(tr("⚡ На сьогодні більше немає дій. Заверши день, щоб відновити сили.","⚡ No actions left today. End the day to recover your strength."), "system");
    render();
    return false;
  }
  energy--;
  return true;
}
function logAction(text,type,marketExempt){
  const tail=marketExempt
    ? tr(" Ринок не витрачає дії."," The market does not spend actions.")
    : tr(" Залишилось дій: "," Actions left: ")+energy+" / "+dailyActionLimit()+".";
  log(text+tail,type,true);
}
function adjustRelationship(person,effects){
  Object.entries(effects||{}).forEach(([stat,value])=>{
    const max=stat==="health"?20:stat==="loyalty"?20:100;
    person[stat]=clamp((person[stat]||0)+value,0,max);
  });
}
function relationshipSnapshot(person){
  return {bond:person.bond,affection:person.affection,trust:person.trust,love:person.love,loyalty:person.loyalty,health:person.health,strength:person.strength,craft:person.craft,service:person.service,combat:person.combat,obedience:person.obedience};
}
function showInteractionEvent(person,interaction,before){
  const labels={
    bond:tr("Зв'язок","Bond"),affection:tr("Прихильність","Affection"),trust:tr("Довіра","Trust"),
    love:tr("Любов","Love"),loyalty:tr("Лояльність","Loyalty"),health:tr("Здоров'я","Health"),
    strength:tr("Сила","Strength"),craft:tr("Ремесло","Craft"),service:tr("Гостинність","Hospitality"),
    combat:tr("Бій","Combat"),obedience:tr("Покірність","Obedience")
  };
  if(!person){
    document.getElementById("interactionTitle").innerText=interaction.name;
    document.getElementById("interactionText").innerText=interaction.scene||interaction.desc;
    document.getElementById("interactionEffect").innerHTML=Object.entries(interaction.effects||{}).map(([label,value])=>`<span class="badge effect-positive">${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join("");
    document.getElementById("interactionModal").classList.remove("hidden");
    return;
  }
  const effects=Object.keys(interaction.effects).map(stat=>{
    const change=(person[stat]||0)-(before[stat]||0);
    return `<span class="badge ${change<0?"effect-negative":"effect-positive"}">${labels[stat]||stat}: ${change>=0?"+":""}${change}</span>`;
  }).join("");
  document.getElementById("interactionTitle").innerText=interaction.name+tr(" з "," with ")+profileName(person);
  document.getElementById("interactionText").innerText=interaction.scene||interaction.desc;
  document.getElementById("interactionEffect").innerHTML=effects+`<span class="badge">${tr("Стосунки","Relations")}: ${relationshipRank(person)} / 10</span>`;
  document.getElementById("interactionModal").classList.remove("hidden");
}
function closeInteraction(){document.getElementById("interactionModal").classList.add("hidden");_checkPendingTravelAnim();}
function availableInteractions(person){
  return interactionCatalog.filter(interaction=>{
    if(interaction.adultOnly && !isAdult(person)) return false;
    if(interaction.freeOnly && !romanticEligible(person)) return false;
    if(interaction.minRank && relationshipRank(person)<interaction.minRank) return false;
    return true;
  });
}
function interactWithNPC(id,interactionId){
  const person=findOwnedAny(id);
  const interaction=interactionCatalog.find(entry=>entry.id===interactionId);
  if(!person || !interaction || !availableInteractions(person).includes(interaction)) return;
  if(!requireCurrentNpc(person)) return;
  if(person.interactionDays[interactionId]===day){
    log("❌ Цю взаємодію з "+profileName(person)+" вже використано сьогодні.");
    render();
    return;
  }
  if(gold<interaction.cost){log("❌ Для цієї взаємодії потрібно "+interaction.cost+" монет.");render();return;}
  if(!consumeAction(interaction.name)) return;
  const before=relationshipSnapshot(person);
  gold-=interaction.cost;
  person.interactionDays[interactionId]=day;
  adjustRelationship(person,interaction.effects);
  logAction("💬 "+profileName(person)+": «"+interaction.name+"». Рівень стосунків: "+relationshipRank(person)+" ("+relationshipLabel(person)+").","relation");
  // v0.43 fix: close relationship modal before showing interaction result so it doesn't overlap
  closeRelationshipDialog();
  showInteractionEvent(person,interaction,before);
  saveGame(false);
  render();
}
function furnishPrivateRoom(id){
  const person=findOwnedAny(id);
  const cost=260;
  if(!person || !romanticEligible(person) || relationshipRank(person)<9 || person.privateRoom) return;
  if(!requireHeadquartersPresence() || !requireCurrentNpc(person)) return;
  if(!roomByKey("house").familyWingRestored){log("❌ Спершу відновіть сімейні кімнати в Домі торговця.","system");render();return;}
  if(gold<cost){log("❌ Для облаштування приватної кімнати потрібно "+cost+" монет.");render();return;}
  if(!consumeAction("облаштування кімнати")) return;
  const before=relationshipSnapshot(person);
  gold-=cost;
  person.privateRoom=true;
  adjustRelationship(person,{bond:6,trust:5,affection:4});
  logAction("🛏️ Для "+profileName(person)+" облаштовано окрему приватну кімнату за "+cost+" монет.","family");
  showInteractionEvent(person,{name:"Приватна кімната",scene:"Ви показали нову кімнату, облаштовану спеціально для цієї людини. Цей жест означає серйозність ваших намірів.",effects:{bond:6,trust:5,affection:4}},before);
  saveGame(false);
  render();
}
function proposeMarriage(id){
  const person=findOwnedAny(id);
  if(!person || person.spouse) return;
  if(!requireHeadquartersPresence() || !requireCurrentNpc(person)) return;
  if(!romanticEligible(person)){
    log("❌ Шлюб можливий лише з вільним повнолітнім NPC, який не є дитиною головного героя. Підневільну людину спершу потрібно звільнити.");
    render();
    return;
  }
  if(!person.privateRoom){log("❌ Для шлюбу спершу облаштуйте окрему приватну кімнату.");render();return;}
  if(relationshipRank(person)<10 || person.trust<70 || person.love<60){
    log("❌ Для пропозиції потрібні стосунки 10 рівня, довіра 70 і любов 60.");
    render();
    return;
  }
  if(!consumeAction("пропозиція шлюбу")) return;
  const before=relationshipSnapshot(person);
  person.spouse=true;
  person.familyStatus="У шлюбі з головним героєм";
  adjustRelationship(person,{bond:10,affection:10,trust:10,love:10,loyalty:3});
  adjustReputation(2);
  unlockAchievement("first_marriage");
  logAction("💍 "+profileName(person)+" приймає пропозицію шлюбу. У торговому домі створено нову родину. Репутація +2.","family");
  showInteractionEvent(person,{name:"Пропозиція шлюбу",scene:"Ваша пропозиція була прийнята. Відтепер у цієї людини є власна кімната і місце в родині торгового дому.",effects:{bond:10,affection:10,trust:10,love:10,loyalty:3}},before);
  saveGame(false);
  render();
}
function planChild(id){
  const mother=findOwnedAny(id);
  if(!mother || !mother.spouse || mother.gender!=="female" || !romanticEligible(mother)) return;
  if(!requireHeadquartersPresence() || !requireCurrentNpc(mother)) return;
  if(mother.pregnantUntil){log("❌ "+profileName(mother)+" уже очікує дитину.");render();return;}
  if(relationshipRank(mother)<10 || !mother.privateRoom){log("❌ Для створення родини потрібні близькі стосунки й приватна кімната.");render();return;}
  if(gold<80){log("❌ Для підготовки до народження дитини потрібно 80 монет.");render();return;}
  if(!consumeAction("планування родини")) return;
  gold-=80;
  mother.pregnantUntil=day+12;
  logAction("👶 "+profileName(mother)+tr(" та головний герой очікують дитину. Народження очікується біля дня "," and the hero are expecting a child. Birth around day ")+mother.pregnantUntil+".","family");
  showInteractionEvent(mother,{name:"Рішення про родину",scene:"Ви разом домовилися розширити родину і приготувати дім до появи дитини.",effects:{}},relationshipSnapshot(mother));
  saveGame(false);
  render();
}
function renameNPC(id,field){
  const person=findOwnedAny(id);
  if(!person) return;
  if(!requireCurrentNpc(person)) return;
  const label=field==="nickname"?"прізвисько":field==="surname"?"прізвище":"ім'я";
  const current=field==="nickname"?person.nickname:field==="surname"?person.surname:person.name;
  const value=promptClean("Введіть нове "+label+" для NPC",current,34);
  if(!value || value===current) return;
  if(!consumeAction("зміна "+label+" NPC")) return;
  if(field==="nickname") person.nickname=value;
  else if(field==="surname"){
    person.surname=value;
    person.surnameEn=value;
  }else{
    person.name=value;
    person.nameEn=value;
  }
  if(person.childOf && field==="surname") person.familyStatus="Дитина головного героя і "+(person.childOf.motherName||"матері");
  logAction("✍️ NPC тепер має "+label+": "+profileName(person)+".","people");
  saveGame(false);
  render();
}
function createFamilyChild(mother){
  const childGender=pick(["male","female"]);
  const childIdentity=randomNpcIdentity(childGender,mother.locationCity);
  const chosenName=promptClean("Як назвати дитину?",childIdentity.name,34);
  const child=makeNPC("child",mother.locationCity,{
    gender:childGender,
    name:chosenName||childIdentity.name,
    nameEn:chosenName&&chosenName!==childIdentity.name?chosenName:childIdentity.nameEn,
    surname:mother.surname,
    surnameEn:mother.surnameEn||mother.surname,
    status:"child",
    profession:"Дитина торгового дому",
    age:0,
    price:0,
    value:0,
    job:"Зростає в родині",
    familyStatus:"Дитина головного героя і "+profileName(mother),
    story:"Народилася у родині торгового дому. Батько - головний герой, мати - "+profileName(mother)+".",
    hope:"зростатиме серед мандрів, ремесел і родинної турботи",
    childOf:{father:"Головний герой",motherId:mother.id,motherName:profileName(mother)},
    bond:75,affection:80,trust:75,love:0,childGrowth:0,
    spouse:false,privateRoom:false,pregnantUntil:null
  });
  child.value=0;
  ownedHirelings.push(child);
  unlockAchievement("first_child");
  return child;
}
function processFamily(){
  ownedPeople().forEach(person=>{
    if(person.status==="child"){
      person.childGrowth=(person.childGrowth||0)+1;
      if(person.childGrowth>=20 && person.age<18){
        person.childGrowth=0;
        person.age++;
        if(person.age===18){
          person.status="citizen";
          person.profession="Спадкоємець торгового дому";
          person.job="Без роботи";
          log("🎂 "+profileName(person)+" досягає повноліття і тепер може працювати та будувати власні стосунки.","family");
        }
      }
    }
    if(person.gender==="female" && person.pregnantUntil && day>=person.pregnantUntil){
      person.pregnantUntil=null;
      const child=createFamilyChild(person);
      log("👶 "+tr("У родині народжується ","A child is born to the family: ")+profileName(child)+". "+tr("Мати: ","Mother: ")+profileName(person)+", "+tr("батько: головний герой.","father: the hero."),"family");
    }
  });
}
function oldAgeMortalityChance(age){
  if(age<BALANCE.oldAgeStart) return 0;
  if(age<=69) return BALANCE.oldAgeMortality[69];
  if(age<=79) return BALANCE.oldAgeMortality[79];
  if(age<=89) return BALANCE.oldAgeMortality[89];
  if(age<=90) return BALANCE.oldAgeMortality[90];
  return 0;
}
function removeDeceased(person){
  ownedSlaves=ownedSlaves.filter(other=>other.id!==person.id);
  ownedHirelings=ownedHirelings.filter(other=>other.id!==person.id);
  leaveProfileIfRemoved(person.id);
  log("🕯️ "+profileName(person)+tr(" помирає від старості у віці "," dies of old age at ")+person.age+tr(" років. Торговий дім зберігає пам'ять про цю людину."," years. The trading house remembers this person."),"family");
}
function processMortality(){
  ownedPeople().slice().forEach(person=>{
    if(person.status==="child") return;
    person.ageProgress=(person.ageProgress||0)+1;
    if(person.ageProgress<20) return;
    person.ageProgress=0;
    person.age++;
    if(person.age>BALANCE.immortalAge){
      if(!person.longLived){
        person.longLived=true;
        log("🌿 "+profileName(person)+tr(" переживає дев'яносто років і здобуває навичку «Довгожитель»: від старості ця людина більше не помре."," lives past ninety and gains the «Long-lived» trait: old age will no longer take this person."),"family");
      }
      return;
    }
    if(Math.random()<oldAgeMortalityChance(person.age)) removeDeceased(person);
  });
}
function seedCityPopulation(cityIndex,count){
  while(npcMarket.filter(person=>person.city===cityIndex).length<count){
    const cityCount=npcMarket.filter(person=>person.city===cityIndex).length;
    npcMarket.push(makeNPC(cityCount%4===3?"slave":"free",cityIndex));
  }
}

function goodFactor(cityIndex,name){
  const city=cities[cityIndex];
  if(city.demand.includes(name)) return BALANCE.demandPriceMultiplier;
  if(city.supply.includes(name)) return BALANCE.supplyPriceMultiplier;
  return 1;
}
function naturalStockFor(factor){
  if(factor<1) return BALANCE.naturalStock.supply;
  if(factor>1) return BALANCE.naturalStock.demand;
  return BALANCE.naturalStock.neutral;
}
// Ціна реагує на запас: запас нижчий за рівноважний робить товар дорожчим, вищий — дешевшим.
function stockPriceMultiplier(stock,natural){
  const ratio=natural/clamp(stock,1,natural*3);
  return clamp(Math.pow(ratio,BALANCE.marketElasticity),BALANCE.marketElasticityMin,BALANCE.marketElasticityMax);
}
function marketAnchor(g){return Math.max(3,Math.round(g.base*g.factor*(g.shock||1)*seasonModifier(g.name)));}
// Перераховує живі ціни купівлі/продажу з якоря (база×фактор×шок×сезон) і поточного запасу.
function repriceGood(g){
  const anchor=g.base*g.factor*(g.shock||1)*seasonModifier(g.name);
  const m=stockPriceMultiplier(g.stock,g.naturalStock);
  g.buy=Math.max(3,Math.round(anchor*m));
  g.sell=Math.max(2,Math.round(g.buy*BALANCE.baseSaleMultiplier));
}
function makeMarketGood(cityIndex,definition){
  const factor=goodFactor(cityIndex,definition.name);
  const natural=naturalStockFor(factor);
  const g={name:definition.name,base:definition.base,factor,naturalStock:natural,
    stock:clamp(natural+rand(-4,4),1,80),shock:1,shockDays:0,shockType:null,buy:0,sell:0};
  repriceGood(g);
  return g;
}
function createMarkets(){
  return cities.map((city,cityIndex)=>({goods:goodsPool.map(g=>makeMarketGood(cityIndex,g))}));
}

function migrateMarkets(savedMarkets){
  const complete=createMarkets();
  (savedMarkets||[]).forEach((market,index)=>{
    if(complete[index] && market && Array.isArray(market.goods)){
      complete[index].goods.forEach(fresh=>{
        const old=market.goods.find(item=>item&&item.name===fresh.name);
        if(!old) return;
        fresh.stock=integerInRange(old.stock,fresh.stock,0,200);
        fresh.shock=(typeof old.shock==="number" && old.shock>0)?clamp(old.shock,0.4,2.2):1;
        fresh.shockDays=integerInRange(old.shockDays,0,0,30);
        fresh.shockType=fresh.shockDays>0?(["shortage","glut"].includes(old.shockType)?old.shockType:null):null;
        repriceGood(fresh);
      });
    }
  });
  return complete;
}
function sanitizeInventory(record,validIds){
  const result={};
  if(!record || typeof record!=="object") return result;
  Object.entries(record).forEach(([key,value])=>{
    if(validIds.has(key) && Number.isInteger(value) && value>0) result[key]=Math.min(value,100000);
  });
  return result;
}
function validGoods(){return new Set(goodsPool.map(good=>good.name));}
function validItemIds(){return new Set(itemCatalog.map(item=>item.id));}
function validHomeItemIds(){return new Set(homeItemCatalog.map(item=>item.id));}
function sanitizeShopStock(record){
  if(!record || typeof record!=="object") return null;
  const validNpc=validItemIds();
  const validHome=validHomeItemIds();
  const cleanEntry=entry=>({
    week:integerInRange(entry&&entry.week,-1,-1,999999),
    npcIds:Array.isArray(entry&&entry.npcIds)?entry.npcIds.filter(id=>validNpc.has(id)).slice(0,BALANCE.shopStockSize):[],
    homeIds:Array.isArray(entry&&entry.homeIds)?entry.homeIds.filter(id=>validHome.has(id)).slice(0,BALANCE.shopStockSize):[]
  });
  if(record.cities && typeof record.cities==="object"){
    const citiesStock={};
    Object.entries(record.cities).forEach(([city,entry])=>{
      const index=Number(city);
      if(Number.isInteger(index) && index>=0 && index<cities.length) citiesStock[index]=cleanEntry(entry);
    });
    return {cities:citiesStock};
  }
  const city=validCityIndex(record.city,currentCity||0);
  return {cities:{[city]:{
    week:integerInRange(record.week,-1,-1,999999),
    npcIds:Array.isArray(record.npcIds)?record.npcIds.filter(id=>validNpc.has(id)).slice(0,BALANCE.shopStockSize):[],
    homeIds:Array.isArray(record.homeIds)?record.homeIds.filter(id=>validHome.has(id)).slice(0,BALANCE.shopStockSize):[]
  }}};
}
function safeJournal(entries){
  return Array.isArray(entries)?entries.slice(0,BALANCE.journalLimit).map(entry=>({
    day:integerInRange(entry&&entry.day,1,1,999999),
    text:safeStoredText(entry&&entry.text,"Подію не вдалося відновити.",420),
    type:["system","relation","family","market","shop","caravan","travel","people","hq","quest","danger","achievement"].includes(entry&&entry.type)?entry.type:"system"
  })):[];
}
function sanitizeAchievements(record){
  const result={};
  const ids=new Set(achievementCatalog.map(entry=>entry.id));
  if(!record || typeof record!=="object") return result;
  Object.entries(record).forEach(([id,value])=>{
    if(ids.has(id)) result[id]={day:integerInRange(value&&value.day,day||1,1,999999),title:safeStoredText(value&&value.title,achievementCatalog.find(entry=>entry.id===id).title,90)};
  });
  return result;
}

function distanceBetween(from,to){
  const dx=cities[from].x-cities[to].x;
  const dy=cities[from].y-cities[to].y;
  return Math.sqrt(dx*dx+dy*dy);
}
function hasClownTravelSet(){return hasItemAnywhere("clown_cap") && hasItemAnywhere("clown_boots");}
function travelDaysBetween(from,to){
  const base=clamp(Math.ceil(distanceBetween(from,to)/5),1,8);
  return Math.max(1,base-(hasClownTravelSet()?1:0));
}
function travelPriceBetween(from,to){
  const days=travelDaysBetween(from,to);
  return 10+days*10+Math.ceil(distanceBetween(from,to)*2);
}
function routeRiskForDays(days){return days>=5?"Високий":days>=3?"Середній":"Низький";}
function riskLabel(risk){
  return tr(risk,({Низький:"Low",Середній:"Medium",Високий:"High"}[risk]||risk));
}
function routeName(route){
  return route?cityName(route.from)+" → "+cityName(route.to):"";
}
function routeBetween(from,to){
  if(from===to || !cities[from] || !cities[to]) return null;
  const existing=routes.find(route=>route.from===from && route.to===to);
  if(existing) return existing;
  const days=travelDaysBetween(from,to);
  return {id:1000+from*100+to,from,to,name:cities[from].name+" → "+cities[to].name,days,risk:routeRiskForDays(days),fee:Math.max(18,Math.round(travelPriceBetween(from,to)*0.6))};
}
function routeById(id){
  const original=routes.find(route=>route.id===id);
  if(original) return original;
  const encoded=id-1000;
  if(encoded<0) return null;
  return routeBetween(Math.floor(encoded/100),encoded%100);
}
function availableRoutesFrom(from){
  return cities.map((city,to)=>routeBetween(from,to)).filter(Boolean);
}
function sanitizeCaravans(saved){
  return Array.isArray(saved)?saved.map(caravan=>{
    const route=routeById(caravan&&caravan.routeId);
    if(!route || !validGoods().has(caravan.good)) return null;
    return {
      id:integerInRange(caravan.id,1,1,100000000),
      routeId:route.id,
      name:route.name,
      good:caravan.good,
      qty:integerInRange(caravan.qty,1,1,100000),
      remaining:integerInRange(caravan.remaining,route.days,1,100),
      destination:route.to
    };
  }).filter(Boolean):[];
}
function supplierFor(good,destination){
  const candidates=cities.map((city,index)=>index).filter(index=>index!==destination && cities[index].supply.includes(good));
  return pick(candidates.length?candidates:cities.map((city,index)=>index).filter(index=>index!==destination));
}
function contractTier(investment){
  if(investment>=820) return 4;
  if(investment>=450) return 3;
  if(investment>=230) return 2;
  return 1;
}
function contractNumbers(source,destination,good,qty,kind,difficulty){
  const market=markets[source]&&markets[source].goods.find(entry=>entry.name===good);
  const goodsCost=(market?market.buy:goodsPool.find(entry=>entry.name===good).base)*qty;
  const transport=travelPriceBetween(destination,source)+travelPriceBetween(source,destination);
  const investment=goodsCost+transport;
  const tier=contractTier(investment);
  const payment=kind==="council"?0:Math.max(24,Math.round(investment*(0.10+difficulty*0.025)));
  return {goodsCost,transport,investment,tier,payment};
}
function questDifficulty(){return clamp(playerLevel()+rand(-1,1),1,15);}
function visibleCouncilReward(difficulty,tier){
  if(difficulty<=3) return {type:"goods",name:pick(["Зерно","Віск","Льон","Сіль"]),qty:rand(2,4)};
  if(difficulty%2===0){
    const rarity=difficulty>=10?"rare":difficulty>=6?"improved":"common";
    const choices=itemCatalog.filter(item=>!item.loot && item.rarity===rarity);
    return {type:"npcItem",id:pick(choices).id};
  }
  const rarity=difficulty>=9?"rare":"common";
  const choices=homeItemCatalog.filter(item=>!item.loot && item.rarity===rarity);
  return {type:"homeItem",id:pick(choices).id};
}
function makeGuildQuest(issuer){
  const levelDifficulty=questDifficulty();
  const good=pick(cities[issuer].demand.filter(name=>name!=="Зброя"&&name!=="Обладунки"));
  const source=supplierFor(good,issuer);
  const qty=rand(1+Math.floor(levelDifficulty/4),3+Math.floor(levelDifficulty/3));
  let numbers=contractNumbers(source,issuer,good,qty,"guild",levelDifficulty);
  const difficulty=clamp(levelDifficulty+Math.max(0,numbers.tier-1),1,15);
  numbers=contractNumbers(source,issuer,good,qty,"guild",difficulty);
  return {id:guildQuestId++,kind:"guild",difficulty,issuer,source,destination:issuer,good,qty,acquired:0,delivered:0,accepted:false,deadline:null,title:"Поставити дефіцитний товар",reason:"Купецька гільдія отримала замовлення на дефіцитний товар і шукає перевізника.",...numbers};
}
function freshGuildBoard(cityIndex){return [makeGuildQuest(cityIndex),makeGuildQuest(cityIndex),makeGuildQuest(cityIndex)];}
function createGuildBoards(){return cities.map((city,index)=>freshGuildBoard(index));}
function makeCouncilQuest(issuer){
  const levelDifficulty=questDifficulty();
  const request=pick(councilRequests);
  const good=pick(request.goods.filter(name=>name!=="Зброя"&&name!=="Обладунки"));
  const source=supplierFor(good,issuer);
  const qty=rand(2+Math.floor(levelDifficulty/4),4+Math.floor(levelDifficulty/3));
  const numbers=contractNumbers(source,issuer,good,qty,"council",levelDifficulty);
  const difficulty=clamp(levelDifficulty+Math.max(0,numbers.tier-1),1,15);
  return {id:guildQuestId++,kind:"council",difficulty,issuer,source,destination:issuer,good,qty,acquired:0,delivered:0,reward:visibleCouncilReward(difficulty,numbers.tier),accepted:false,deadline:null,title:request.title,reason:request.reason,...numbers};
}
function freshCouncilBoard(cityIndex){return [makeCouncilQuest(cityIndex),makeCouncilQuest(cityIndex)];}
function createCouncilBoards(){return cities.map((city,index)=>freshCouncilBoard(index));}
function sanitizeReward(reward){
  if(!reward || typeof reward!=="object") return null;
  if(reward.type==="goods" && validGoods().has(reward.name)) return {type:"goods",name:reward.name,qty:integerInRange(reward.qty,1,1,100)};
  if(reward.type==="npcItem" && validItemIds().has(reward.id)) return {type:"npcItem",id:reward.id};
  if(reward.type==="homeItem" && validHomeItemIds().has(reward.id)) return {type:"homeItem",id:reward.id};
  return null;
}
function sanitizeAcceptedQuest(entry,kind,issuer){
  if(!entry || entry.kind!==kind || !entry.accepted || !validGoods().has(entry.good)) return null;
  const source=validCityIndex(entry.source,-1);
  if(source<0) return null;
  const difficulty=integerInRange(entry.difficulty,1,1,15);
  const qty=integerInRange(entry.qty,1,1,100);
  const quest={
    ...entry,
    id:integerInRange(entry.id,guildQuestId++,1,100000000),
    kind,
    issuer,
    source,
    destination:issuer,
    difficulty,
    qty,
    acquired:integerInRange(entry.acquired,0,0,qty),
    delivered:integerInRange(entry.delivered,0,0,qty),
    deadline:integerInRange(entry.deadline,day+1,1,999999),
    title:safeStoredText(entry.title,kind==="guild"?"Поставити дефіцитний товар":"Замовлення мерії",80),
    reason:safeStoredText(entry.reason,"Міській громаді потрібне постачання.",240),
    payment:kind==="guild"?integerInRange(entry.payment,24,0,1000000):0
  };
  quest.guarded=kind==="guild" && Boolean(entry.guarded);
  quest.investment=integerInRange(entry.investment,0,0,100000000);
  quest.tier=integerInRange(entry.tier,1,1,4);
  if(kind==="council") quest.reward=sanitizeReward(entry.reward)||{type:"goods",name:"Зерно",qty:2};
  return quest;
}
function migrateQuestBoards(savedBoards,kind,count){
  return cities.map((city,index)=>{
    const board=(savedBoards&&Array.isArray(savedBoards[index]))?savedBoards[index].map(entry=>sanitizeAcceptedQuest(entry,kind,index)).filter(Boolean):[];
    while(board.length<count) board.push(kind==="guild"?makeGuildQuest(index):makeCouncilQuest(index));
    return board.slice(0,count);
  });
}
function refreshAvailableQuestBoards(){
  cities.forEach((city,index)=>{
    guildBoards[index]=guildBoards[index].map(quest=>quest.accepted?quest:makeGuildQuest(index));
    councilBoards[index]=councilBoards[index].map(quest=>quest.accepted?quest:makeCouncilQuest(index));
  });
}
function questById(id){
  for(const board of guildBoards.concat(councilBoards)){
    const quest=board.find(entry=>entry.id===id);
    if(quest) return quest;
  }
  return null;
}
function activeQuests(){return guildBoards.concat(councilBoards).flat().filter(quest=>quest.accepted);}
function guardedQuestProtection(){
  return activeQuests().some(quest=>quest.kind==="guild" && quest.guarded && quest.deadline>=day);
}
function acceptQuest(id,guarded=false){
  const quest=questById(id);
  if(!quest || quest.issuer!==currentCity || quest.accepted) return;
  if(isCityLocked(currentCity)){openCityLockModal();return;}
  const activeOfKind=activeQuests().filter(active=>active.kind===quest.kind).length;
  const limit=quest.kind==="guild"?2:1;
  if(activeOfKind>=limit){
    log("❌ Одночасно можна мати не більше "+limit+" "+(quest.kind==="guild"?"замовлень гільдії":"замовлення мерії")+".","quest");
    render();
    return;
  }
  if(!consumeAction("прийняття замовлення")) return;
  quest.accepted=true;
  quest.guarded=quest.kind==="guild" && Boolean(guarded);
  quest.acquired=0;
  quest.delivered=0;
  quest.deadline=day+travelDaysBetween(quest.issuer,quest.source)+travelDaysBetween(quest.source,quest.destination)+Math.max(3,8-Math.ceil(quest.difficulty/3));
  const author=quest.kind==="guild"?"гільдії":"мерії";
  logAction("📜 Прийнято замовлення "+author+" "+cities[quest.issuer].name+": закупити "+quest.qty+" × "+quest.good+" у місті "+cities[quest.source].name+" та доставити до "+cities[quest.destination].name+"."+(quest.guarded?" Найнята охорона забере 20% винагороди, але зменшить ризик нападу.":""),"quest");
  saveGame(false);
  render();
}
function replaceQuest(quest){
  const board=(quest.kind==="guild"?guildBoards:councilBoards)[quest.issuer];
  const index=board.findIndex(entry=>entry.id===quest.id);
  if(index>=0) board[index]=quest.kind==="guild"?makeGuildQuest(quest.issuer):makeCouncilQuest(quest.issuer);
}
function grantCouncilReward(reward){
  // v0.43: harden against corrupted/missing reward data
  if(!reward||!reward.type) return "—";
  if(reward.type==="goods"){
    if(!reward.name||!Number.isFinite(reward.qty)||reward.qty<1) return "—";
    addItem(reward.name,reward.qty);
    return reward.qty+" × "+goodName(reward.name);
  }
  if(reward.type==="homeItem"){
    const item=homeItemById(reward.id);
    if(!item) return "—";
    homeInventory[reward.id]=homeStock(reward.id)+1;
    return "«"+item.name+"»";
  }
  const item=itemById(reward.id);
  if(!item) return "—";
  itemInventory[reward.id]=itemStock(reward.id)+1;
  return "«"+item.name+"»";
}
function completeQuest(quest){
  const repGain=quest.kind==="guild"?1:2;
  adjustReputation(repGain,quest.destination);
  const xp=quest.kind==="guild"?10+quest.difficulty*4:14+quest.difficulty*5;
  let popupReward="";
  if(quest.kind==="guild"){
    const guardFee=quest.guarded?Math.ceil(quest.payment*0.2):0;
    const paid=Math.max(0,quest.payment-guardFee);
    gold+=paid;
    popupReward="+"+paid+" монет"+(guardFee?"; охорона отримала "+guardFee:"");
    log("📜 "+tr("Замовлення гільдії виконано. Виплачено +","Guild order fulfilled. Paid +")+paid+tr(" монет"," coins")+(guardFee?(tr(" після плати охороні "," after guard fee ")+guardFee):"")+". "+tr("Репутація ","Reputation ")+cityName(quest.destination)+" +"+repGain+".","quest");
  }else{
    const rewardText=grantCouncilReward(quest.reward);
    player.warehouseBonus=(player.warehouseBonus||0)+1;
    popupReward=rewardText+", склад +1";
    log("🏛️ "+tr("Замовлення мерії виконано. Отримано ","Council order fulfilled. Received ")+rewardText+tr(", склад +1. Репутація ",", warehouse +1. Reputation ")+cityName(quest.destination)+" +"+repGain+".","quest");
  }
  showInteractionEvent(null,{name:"Завдання виконано",scene:"Контракт завершено у місті "+cities[quest.destination].name+". Винагорода: "+popupReward+". Репутація міста +"+repGain+".",effects:{"Винагорода":popupReward,"Репутація":"+"+repGain}}, {});
  gainExperience(xp,quest.kind==="guild"?"контракт гільдії":"доручення мерії");
  const hiddenChance=quest.kind==="council" && quest.difficulty>=10?0.12:0;
  if(Math.random()<hiddenChance){
    let possible=homeItemCatalog.filter(item=>!item.loot && (quest.tier>=3?item.rarity==="rare":item.rarity==="common"));
    if(quest.difficulty>=13 && Math.random()<0.22) possible=homeItemCatalog.filter(item=>item.loot && homeStock(item.id)<1);
    if(possible.length){
      const furnishing=pick(possible);
      homeInventory[furnishing.id]=homeStock(furnishing.id)+1;
      log("🎁 Додаткова несподівана винагорода для штабу: «"+furnishing.name+"» ("+itemRarity(furnishing).name+").","quest");
    }
  }
  checkLegendaryAchievements();
  replaceQuest(quest);
}
function trackContractPurchase(good,qty,cityIndex){
  let unassigned=qty;
  activeQuests().filter(quest=>quest.good===good && quest.source===cityIndex && quest.deadline>=day && quest.acquired<quest.qty).sort((a,b)=>a.deadline-b.deadline).forEach(quest=>{
    const received=Math.min(unassigned,quest.qty-quest.acquired);
    quest.acquired+=received;
    unassigned-=received;
  });
}
function trackGuildSale(good,qty,cityIndex){
  let unassigned=qty;
  activeQuests().filter(quest=>quest.kind==="guild" && quest.good===good && quest.destination===cityIndex && quest.deadline>=day && quest.delivered<quest.qty).sort((a,b)=>a.deadline-b.deadline).forEach(quest=>{
    const remaining=quest.qty-quest.delivered;
    const alreadyBought=Math.max(0,(quest.acquired||0)-quest.delivered);
    const delivered=Math.min(unassigned,remaining,Math.max(1,alreadyBought||unassigned));
    quest.delivered+=delivered;
    quest.acquired=Math.max(quest.acquired||0,quest.delivered);
    unassigned-=delivered;
    if(quest.delivered>=quest.qty) completeQuest(quest);
  });
}
function deliverCouncilQuest(id){
  const quest=questById(id);
  if(!quest || quest.kind!=="council" || !quest.accepted || quest.destination!==currentCity) return;
  const ready=Math.min(inventoryCount(quest.good),quest.acquired-quest.delivered,quest.qty-quest.delivered);
  if(ready<1){log("❌ "+tr("Для передачі мерії спершу придбайте визначений товар у місті ","To deliver to the council, first buy the required goods in ")+cityName(quest.source)+tr(" і привезіть сюди."," and bring them here."));render();return;}
  if(!consumeAction(tr("передача товару мерії","delivering goods to the council"))) return;
  removeItem(quest.good,ready);
  quest.delivered+=ready;
  logAction("🏛️ "+tr("Мерії ","Delivered to the council of ")+cityName(currentCity)+": "+ready+" × "+goodName(quest.good)+".","quest");
  if(quest.delivered>=quest.qty) completeQuest(quest);
  saveGame(false);
  render();
}
function expireQuests(){
  activeQuests().filter(quest=>quest.deadline<day).forEach(quest=>{
    adjustReputation(-1,quest.issuer);
    log("⌛ "+tr("Замовлення міста ","Order from ")+cityName(quest.issuer)+tr(" провалено: минув строк доставки. Репутація -1."," failed: the delivery deadline has passed. Reputation -1."),"quest");
    replaceQuest(quest);
  });
}

function startNewState(){
  // v0.43: use difficulty preset if player has chosen one, else normal
  const diffKey=(player&&player.difficulty)||"normal";
  const diff=DIFFICULTY_LEVELS[diffKey]||DIFFICULTY_LEVELS.normal;
  gold = diff.startingGold;
  food = diff.startingFood;
  day = 1;
  reputation = 0;
  cityReputations = cities.map(()=>0);
  reputationCalmDays = cities.map(()=>0);
  currentCity = 0;
  npcId = 1;
  currentRoom = 0;
  selectedProfileId = null;
  profileReturnTab = "subordinates";
  selectedTravelDestination = null;
  selectedTravelCompanions = [];
  travelCompanionIds = [];
  manualCombatState = null;
  inventory = {};
  itemInventory = {};
  homeInventory = {};
  markets = createMarkets();
  npcMarket = [];
  cities.forEach((city,index)=>seedCityPopulation(index,8));
  ownedSlaves = [];
  ownedHirelings = [];
  activeCaravans = [];
  rooms = makeRooms();
  journal = [];
  daySummary = [];
  achievements = {};
  visitedCities = [currentCity];
  shopStock = null;
  energy = dailyActionLimit();
  player = {
    name:"Майбутній торговець",
    age:27,
    born:CAMPAIGN_YEAR-27,
    birthCity:0,
    portrait:"yakiv",
    headquartersCity:null,
    created:false,
    xp:0,
    warehouseBonus:0,
    lifeElixirs:0,
    hiddenQuests:{},
    foundHiddenPlaces:[],
    history:["1205 рік: шлях ще не розпочато."]
  };
  securityUntil = 0;
  caravanBoostUntil = 0;
  kitchenUntil = 0;
  roomActionsUsed = {};
  caravanId = 1;
  guildQuestId = 1;
  guildBoards = createGuildBoards();
  councilBoards = createCouncilBoards();
}

function stateData(){
  return {gold,food,day,reputation,cityReputations,reputationCalmDays,currentCity,npcId,currentRoom,inventory,itemInventory,homeInventory,markets,npcMarket,ownedSlaves,ownedHirelings,activeCaravans,rooms,journal,daySummary,energy,player,achievements,visitedCities,shopStock,travelCompanionIds,securityUntil,caravanBoostUntil,kitchenUntil,roomActionsUsed,caravanId,guildBoards,councilBoards,guildQuestId};
}

function saveGame(notify){
  if(notify) log("💾 Гру збережено.");
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(stateData()));}
  catch(error){if(notify) log("❌ Не вдалося записати збереження у браузері. Ймовірно, браузер блокує localStorage для file:// або сховище переповнене.");}
  renderLog();
}

function loadGame(){
  try{
    const saved = localStorage.getItem(SAVE_KEY)||LEGACY_SAVE_KEYS.map(key=>localStorage.getItem(key)).find(Boolean);
    if(!saved) return false;
    const state = JSON.parse(saved);
    gold = integerInRange(state.gold,BALANCE.startingGold,0,100000000);
    food = integerInRange(state.food,BALANCE.startingFood,0,100000000);
    day = integerInRange(state.day,1,1,999999);
    reputation = integerInRange(state.reputation,0,-100000,100000);
    cityReputations = Array.isArray(state.cityReputations)
      ? cities.map((city,index)=>integerInRange(state.cityReputations[index],0,-100000,100000))
      : cities.map(()=>reputation);
    reputationCalmDays = Array.isArray(state.reputationCalmDays)
      ? cities.map((city,index)=>integerInRange(state.reputationCalmDays[index],0,0,999999))
      : cities.map(()=>0);
    currentCity = validCityIndex(state.currentCity,0);
    reputation = cityReputation(currentCity);
    npcId = integerInRange(state.npcId,1,1,100000000);
    currentRoom = integerInRange(state.currentRoom,0,0,20);
    inventory = sanitizeInventory(state.inventory,validGoods());
    itemInventory = sanitizeInventory(state.itemInventory,validItemIds());
    homeInventory = sanitizeInventory(state.homeInventory,validHomeItemIds());
    markets = migrateMarkets(state.markets);
    const legacyHq=state.player&&Number.isInteger(state.player.headquartersCity)?state.player.headquartersCity:0;
    npcMarket = (state.npcMarket || []).map(person=>enrichNPC(person,currentCity));
    ownedSlaves = (state.ownedSlaves || []).map(person=>enrichNPC(person,legacyHq));
    ownedHirelings = (state.ownedHirelings || []).map(person=>enrichNPC(person,legacyHq));
    activeCaravans = sanitizeCaravans(state.activeCaravans);
    rooms = migrateRooms(state.rooms);
    currentRoom=clamp(currentRoom,0,rooms.length-1);
    journal = safeJournal(state.journal);
    daySummary = safeJournal(state.daySummary);
    achievements = sanitizeAchievements(state.achievements);
    visitedCities = Array.isArray(state.visitedCities)?[...new Set(state.visitedCities.filter(index=>Number.isInteger(index)&&index>=0&&index<cities.length))]:[currentCity];
    if(!visitedCities.includes(currentCity)) visitedCities.push(currentCity);
    shopStock = sanitizeShopStock(state.shopStock);
    energy = integerInRange(state.energy,dailyActionLimit(),0,dailyActionLimit());
    player = state.player || {name:"Олег Купецький",age:27,born:CAMPAIGN_YEAR-27,birthCity:0,portrait:"yakiv",headquartersCity:0,created:true,xp:0,history:["Торговий дім продовжує свою історію."]};
    player.name=safeStoredText(player.name,"Олег Купецький",34);
    player.story=safeStoredText(player.story,"Шлях торговця пишеться його вчинками.",360);
    player.portrait=heroPresets.some(preset=>preset.portrait===player.portrait)?player.portrait:"yakiv";
    player.age=integerInRange(player.age,27,18,120);
    player.born=integerInRange(player.born,CAMPAIGN_YEAR-player.age,CAMPAIGN_YEAR-120,CAMPAIGN_YEAR-18);
    player.birthCity=validCityIndex(player.birthCity,0);
    player.history=Array.isArray(player.history)?player.history.slice(0,BALANCE.historyLimit).map(text=>safeStoredText(text,"",420)).filter(Boolean):[];
    player.created=player.created!==false;
    player.xp=integerInRange(player.xp,0,0,10000000);
    player.warehouseBonus=integerInRange(player.warehouseBonus,0,0,100000);
    player.lifeElixirs=integerInRange(player.lifeElixirs,0,0,1000);
    player.hiddenQuests=player.hiddenQuests&&typeof player.hiddenQuests==="object"?player.hiddenQuests:{};
    player.foundHiddenPlaces=Array.isArray(player.foundHiddenPlaces)?player.foundHiddenPlaces.map(value=>safeStoredText(value,"",40)).filter(Boolean):[];
    if(player.created && player.headquartersCity===undefined) player.headquartersCity=0;
    player.headquartersCity=Number.isInteger(player.headquartersCity)?validCityIndex(player.headquartersCity,0):null;
    ownedPeople().forEach(person=>{
      if(!Number.isInteger(person.locationCity)) person.locationCity=Number.isInteger(player.headquartersCity)?player.headquartersCity:currentCity;
    });
    securityUntil = state.securityUntil || 0;
    caravanBoostUntil = state.caravanBoostUntil || 0;
    kitchenUntil = state.kitchenUntil || 0;
    roomActionsUsed = state.roomActionsUsed || {};
    caravanId = state.caravanId || 1;
    guildQuestId = state.guildQuestId || 1;
    guildBoards = migrateQuestBoards(state.guildBoards,"guild",3);
    councilBoards = migrateQuestBoards(state.councilBoards,"council",2);
    checkLevelAchievements();
    checkRoomAchievements();
    checkLegendaryAchievements();
    selectedProfileId = null;
    profileReturnTab = "subordinates";
    selectedTravelDestination = null;
    selectedTravelCompanions = [];
    travelCompanionIds = Array.isArray(state.travelCompanionIds)?state.travelCompanionIds.map(id=>integerInRange(id,0,1,100000000)).filter(Boolean).slice(0,4):[];
    manualCombatState = null;
    cities.forEach((city,index)=>seedCityPopulation(index,8));
    return true;
  }catch(error){
    return false;
  }
}

function newGame(){
  if(!window.confirm(tr("Почати нову гру? Поточне збереження буде замінено.","Start a new game? The current save will be replaced."))) return;
  // v0.43: tell CrazyGames active gameplay is ending
  CG.gameplayStop();
  startNewState();
  // v0.43 fix: reset created so welcome → creation flow works
  if(player) player.created=false;
  log(tr("🎮 Нова кампанія v0.43 очікує створення героя.","🎮 New v0.43 campaign awaits character creation."),"system");
  saveGame(false);
  render();
  // Show welcome (language) screen at the start of a new game
  const el=document.getElementById("welcomeModal");
  if(el){el.classList.remove("hidden");}else{showCharacterCreation();}
}
let selectedHeroPreset="yakiv";
let selectedDifficulty="normal";
function selectDifficulty(key){
  if(!DIFFICULTY_LEVELS[key]) return;
  selectedDifficulty=key;
  renderDifficultyChoice();
}
function renderDifficultyChoice(){
  const target=document.getElementById("difficultyChoice");
  if(!target) return;
  target.innerHTML=Object.values(DIFFICULTY_LEVELS).map(d=>{
    const name=lang==="en"?d.name.en:d.name.uk;
    const desc=lang==="en"?d.desc.en:d.desc.uk;
    return `<button class="diff-card ${selectedDifficulty===d.key?"selected":""}" onclick="selectDifficulty('${d.key}')">
      <div class="diff-icon">${d.icon}</div>
      <div class="diff-name">${escapeHtml(name)}</div>
      <div class="diff-desc">${escapeHtml(desc)}</div>
      <div class="diff-stats">💰${d.startingGold} • ⚡${BALANCE.actionsPerDay+d.actionsBonus} • 🍲${d.startingFood}</div>
    </button>`;
  }).join("");
}
function showCharacterCreation(){
  selectedHeroPreset=selectedHeroPreset||heroPresets[0].id;
  selectedDifficulty=(player&&player.difficulty)||"normal";
  document.getElementById("startingCity").innerHTML=cities.map((city,index)=>`<option value="${index}">${cityName(index)} — ${regionName(city.region)}</option>`).join("");
  renderCharacterCreation();
  renderDifficultyChoice();
  document.getElementById("creationModal").classList.remove("hidden");
}
function unlockPageScroll(){
  try{
    document.documentElement.style.overflowY="auto";
    document.documentElement.style.position="";
    document.body.style.overflowY="auto";
    document.body.style.position="relative";
    document.body.style.height="auto";
    const main=document.querySelector(".main");
    if(main) main.scrollTop=0;
    window.scrollTo(0,0);
  }catch(error){}
}
function deferUnlockPageScroll(){
  if(typeof setTimeout==="function") setTimeout(unlockPageScroll,0);
  else unlockPageScroll();
}
function selectHeroPreset(id){
  if(!heroPresets.some(preset=>preset.id===id)) return;
  selectedHeroPreset=id;
  renderCharacterCreation();
}
function renderCharacterCreation(){
  const selected=heroPresets.find(preset=>preset.id===selectedHeroPreset)||heroPresets[0];
  document.getElementById("heroPresets").innerHTML=heroPresets.map(preset=>`<button class="preset-card ${preset.id===selected.id?"active":""}" onclick="selectHeroPreset('${preset.id}')"><span class="preset-thumb"><img src="assets/player/${preset.portrait}_portrait.png" onerror="this.src='assets/player/${preset.portrait}_full.png';this.onerror=function(){this.remove();this.parentElement.innerHTML='🧭'}"></span><span><b>${escapeHtml(heroPresetName(preset))}</b><small>${preset.born} ${t("status.year")}, ${cityName(preset.birthCity)} • ${CAMPAIGN_YEAR-preset.born} ${tr("років","years old")}</small></span></button>`).join("");
  document.getElementById("heroPortraitPreview").innerHTML=`<img src="assets/player/${selected.portrait}_full.png" onerror="this.remove();this.parentElement.innerHTML='${tr("Повноростовий портрет героя","Full-length hero portrait")}'">`;
  document.getElementById("heroPresetName").innerText=heroPresetName(selected)+" — "+(CAMPAIGN_YEAR-selected.born)+" "+tr("років","years old");
  document.getElementById("heroPresetStory").innerText=heroPresetStory(selected)+" "+tr("Народження","Born")+": "+selected.born+" "+t("status.year")+", "+cityName(selected.birthCity)+".";
  document.getElementById("customHeroName").placeholder=heroPresetName(selected);
}
function beginCampaign(){
  const selected=heroPresets.find(preset=>preset.id===selectedHeroPreset)||heroPresets[0];
  const entered=cleanText(document.getElementById("customHeroName").value,"",34);
  const start=validCityIndex(Number(document.getElementById("startingCity").value),0);
  const diff=DIFFICULTY_LEVELS[selectedDifficulty]||DIFFICULTY_LEVELS.normal;
  player={...player,name:entered||heroPresetName(selected),age:CAMPAIGN_YEAR-selected.born,born:selected.born,birthCity:selected.birthCity,portrait:selected.portrait,story:heroPresetStory(selected),currentYear:CAMPAIGN_YEAR,created:true,headquartersCity:null,xp:0,warehouseBonus:0,lifeElixirs:0,hiddenQuests:{},foundHiddenPlaces:[],difficulty:selectedDifficulty,history:["1205 "+t("status.year")+": "+(entered||heroPresetName(selected))+tr(" починає шлях у місті "," begins the road in ")+cityName(start)+tr(" із "," with ")+diff.startingGold+tr(" монет"," coins")+" ("+(lang==="en"?diff.name.en:diff.name.uk)+")."]};
  // Apply difficulty starting resources
  gold=diff.startingGold;
  food=diff.startingFood;
  currentCity=start;
  visitedCities=[start];
  achievements={};
  unlockAchievement("level_1");
  guildBoards=createGuildBoards();
  councilBoards=createCouncilBoards();
  energy=dailyActionLimit();
  document.getElementById("creationModal").classList.add("hidden");
  unlockPageScroll();
  log("🧭 "+player.name+tr(" прибуває до міста "," arrives in ")+cityName(currentCity)+". "+tr("У скарбниці ","Treasury: ")+diff.startingGold+tr(" монет; рівень "," coins; difficulty ")+(lang==="en"?diff.name.en:diff.name.uk)+" "+diff.icon+".","system",true);
  saveGame(false);
  render();
  deferUnlockPageScroll();
  // v0.43: gameplay has officially started
  CG.gameplayStart();
}
function establishHeadquarters(){
  const cost=BALANCE.headquartersCost;
  if(hasHeadquarters()) return;
  if(gold<cost){log("❌ "+tr("Для заснування штабу потрібно ","Founding a headquarters requires ")+cost+tr(" монет."," coins."),"system");render();return;}
  if(!consumeAction(tr("заснування штабу","founding a headquarters"))) return;
  gold-=cost;
  player.headquartersCity=currentCity;
  rooms=makeRooms();
  currentRoom=0;
  gainExperience(25,tr("заснування штабу","founding a headquarters"));
  player.history.unshift(t("status.day")+" "+day+": "+tr("засновано штаб у місті ","headquarters founded in ")+cityName(currentCity)+".");
  logAction("🏰 "+tr("Засновано штаб-квартиру у місті ","Headquarters founded in ")+cityName(currentCity)+tr(" за "," for ")+cost+tr(" монет."," coins."),"hq");
  saveGame(false);
  render();
}

function inventoryCount(name){return inventory[name] || 0;}
function itemById(id){return itemCatalog.find(item=>item.id===id);}
function itemStock(id){return (itemInventory&&itemInventory[id])||0;}
function homeItemById(id){return homeItemCatalog.find(item=>item.id===id);}
function homeStock(id){return homeInventory[id]||0;}
function storeForPerson(person){return person.status==="slave"?"support":"worker";}
function itemRarity(item){return itemRarities[item.rarity||"common"];}
function rarityName(rarityKey){
  const en={common:"Common",improved:"Improved",rare:"Rare",epic:"Exceptional",legendary:"Legendary"};
  if(lang==="en") return en[rarityKey]||(itemRarities[rarityKey]&&itemRarities[rarityKey].name)||rarityKey;
  return (itemRarities[rarityKey]&&itemRarities[rarityKey].name)||rarityKey;
}
function rarityBadge(item){
  const rarity=itemRarity(item);
  return `<span class="badge quality-${rarity.colorClass}">${rarityName(item.rarity||"common")}</span>`;
}
function canEquipItem(person,item){return item.store==="any" || item.store==="combat" || item.store===storeForPerson(person);}
function hasUniqueItem(id){
  return itemStock(id)>0 || ownedPeople().some(person=>Object.values(person.equipment||{}).includes(id));
}
function itemEffectText(item){
  const names={health:"Здоров'я",loyalty:"Лояльність",strength:"Сила",craft:"Ремесло",service:"Гостинність",combat:"Бій",obedience:"Покірність",actionBonus:"Дії",reputationAll:"Репутація"};
  return Object.entries(item.effects).map(([stat,value])=>`${names[stat]||stat} +${value}`).join(", ");
}
function homeEffectText(item){
  const names={comfort:"Затишок",income:"Дохід",capacity:"Місткість",upkeep:"Економія утримання",security:"Безпека",routeSafety:"Безпека каравану",craft:"Ремесло"};
  return Object.entries(item.effects).map(([stat,value])=>`${names[stat]||stat} +${value}`).join(", ");
}
function roomFurnitureBonus(room,stat){
  return (room.furnishings||[]).reduce((sum,id)=>{
    const item=homeItemById(id);
    return sum+(item&&item.effects[stat]||0);
  },0);
}
function buyHomeItem(id){
  const item=homeItemById(id);
  if(!item || item.loot) return;
  if(!localHomeItems().some(offered=>offered.id===id)){log("❌ Цього предмета немає в крамниці міста.","system");render();return;}
  const price=shopPrice(item.price);
  if(gold<price){log("❌ Недостатньо монет для покупки «"+item.name+"».","system");render();return;}
  if(!consumeAction("купівля меблів")) return;
  gold-=price;
  decrementShopStock(id,"home");
  homeInventory[id]=homeStock(id)+1;
  logAction("🪑 Придбано для штабу: "+item.name+" за "+price+" монет.","shop");
  saveGame(false);
  render();
}
function furnishRoom(roomKey,id){
  const room=roomByKey(roomKey);
  const item=homeItemById(id);
  if(!room || !room.unlocked || !item || homeStock(id)<1 || !item.rooms.includes(room.key)) return;
  if(!requireHeadquartersPresence()) return;
  if(!consumeAction("облаштування приміщення")) return;
  let position=(room.furnishings||[]).findIndex(existing=>homeItemById(existing)&&homeItemById(existing).slot===item.slot);
  if(position<0) position=(room.furnishings||[]).findIndex(existing=>!existing);
  if(position<0 && (room.furnishings||[]).length<5) position=room.furnishings.length;
  if(position<0){log("❌ У приміщенні вже зайнято всі п'ять слотів.","system");energy++;render();return;}
  const replaced=room.furnishings[position];
  if(replaced) homeInventory[replaced]=homeStock(replaced)+1;
  room.furnishings[position]=id;
  homeInventory[id]--;
  if(homeInventory[id]===0) delete homeInventory[id];
  logAction("🪑 У приміщенні «"+room.name+"» встановлено «"+item.name+"». "+homeEffectText(item)+".","hq");
  saveGame(false);
  render();
}
function removeFurniture(roomKey,position){
  const room=roomByKey(roomKey);
  if(!room || !room.furnishings[position]) return;
  if(!requireHeadquartersPresence()) return;
  if(!consumeAction("перестановка меблів")) return;
  const id=room.furnishings[position];
  const item=homeItemById(id);
  homeInventory[id]=homeStock(id)+1;
  room.furnishings[position]=null;
  logAction("📦 Із приміщення «"+room.name+"» повернено у запас «"+item.name+"».","hq");
  saveGame(false);
  render();
}
function suitableForPrivateRoom(item){
  return item.rooms.includes("house") && ["bed","table","light","storage"].includes(item.slot);
}
function furnishPrivateRoomItem(personId,id){
  const person=findOwnedAny(personId);
  const item=homeItemById(id);
  if(!person || !person.privateRoom || !item || homeStock(id)<1 || !suitableForPrivateRoom(item)) return;
  if(!requireHeadquartersPresence() || !requireCurrentNpc(person)) return;
  let position=person.privateFurnishings.findIndex(existing=>homeItemById(existing)&&homeItemById(existing).slot===item.slot);
  if(position<0) position=person.privateFurnishings.findIndex(existing=>!existing);
  if(position<0 && person.privateFurnishings.length<5) position=person.privateFurnishings.length;
  if(position<0){log("❌ У приватній кімнаті вже зайнято всі п'ять слотів.","system");render();return;}
  if(!consumeAction("облаштування приватної кімнати")) return;
  const replaced=person.privateFurnishings[position];
  if(replaced) homeInventory[replaced]=homeStock(replaced)+1;
  person.privateFurnishings[position]=id;
  homeInventory[id]--;
  if(homeInventory[id]===0) delete homeInventory[id];
  adjustRelationship(person,{bond:1,affection:2});
  logAction("🛏️ Кімнату "+profileName(person)+" облаштовано предметом «"+item.name+"».","family");
  saveGame(false);
  render();
}
function removePrivateFurniture(personId,position){
  const person=findOwnedAny(personId);
  if(!person || !person.privateFurnishings[position]) return;
  if(!requireHeadquartersPresence() || !requireCurrentNpc(person)) return;
  if(!consumeAction("перестановка приватної кімнати")) return;
  const id=person.privateFurnishings[position];
  const item=homeItemById(id);
  homeInventory[id]=homeStock(id)+1;
  person.privateFurnishings[position]=null;
  logAction("📦 Із кімнати "+profileName(person)+" повернено «"+item.name+"».","family");
  saveGame(false);
  render();
}
function applyItemEffects(person,item){
  const applied={};
  Object.entries(item.effects).forEach(([stat,value])=>{
    const before=person[stat]||0;
    person[stat]=clamp(before+value,0,BALANCE.maxAttribute);
    applied[stat]=person[stat]-before;
  });
  return applied;
}
function removeItemEffects(person,slot,item){
  const applied=person.equipmentApplied[slot]&&Object.keys(person.equipmentApplied[slot]).length?person.equipmentApplied[slot]:item.effects;
  Object.entries(applied).forEach(([stat,value])=>{
    person[stat]=clamp((person[stat]||0)-value,0,BALANCE.maxAttribute);
  });
  person.equipmentApplied[slot]={};
}
function buyGiftItem(id){
  const item=itemById(id);
  if(!item || item.loot) return;
  if(!localShopItems(item.store).some(offered=>offered.id===id)){
    log("❌ "+tr("Цієї речі немає в крамниці міста ","This item is not available in the shop of ")+cityName(currentCity)+".");
    render();
    return;
  }
  const price=shopPrice(item.price);
  if(gold<price){log("❌ "+tr("Недостатньо монет для покупки «","Not enough coins to buy “")+itemName(item)+tr("».","”."));render();return;}
  if(!consumeAction(tr("купівля у крамниці","shopping"))) return;
  gold-=price;
  decrementShopStock(id,"npc");
  itemInventory[id]=itemStock(id)+1;
  logAction("🎁 "+tr("Придбано предмет: ","Bought item: ")+itemName(item)+tr(" за "," for ")+price+tr(" монет."," coins."),"shop");
  saveGame(false);
  render();
}
function equipGift(id,personId){
  const person=findOwnedAny(personId);
  const item=itemById(id);
  if(!person||!item||itemStock(id)<1) return;
  if(!requireCurrentNpc(person)) return;
  if(!canEquipItem(person,item)){
    log("❌ Цей предмет не підходить для статусу "+statusLabel(person)+".");
    render();
    return;
  }
  if(!consumeAction("вручення подарунка")) return;
  const before=relationshipSnapshot(person);
  const replacedId=person.equipment[item.slot];
  if(replacedId){
    const replaced=itemById(replacedId);
    if(replaced){
      removeItemEffects(person,item.slot,replaced);
      itemInventory[replacedId]=itemStock(replacedId)+1;
    }
  }
  itemInventory[id]--;
  if(itemInventory[id]===0) delete itemInventory[id];
  person.equipment[item.slot]=id;
  person.equipmentApplied[item.slot]=applyItemEffects(person,item);
  if(!person.cherishedGiftIds.includes(item.id)){
    person.cherishedGiftIds.push(item.id);
    const giftValue=rarityRanks[item.rarity||"common"]||1;
    adjustRelationship(person,{bond:giftValue*3,affection:giftValue*4,trust:giftValue});
  }
  logAction("🎁 "+profileName(person)+" отримує «"+item.name+"». "+itemEffectText(item)+".","relation");
  showInteractionEvent(person,{name:"Вручення подарунка",scene:"Ви особисто вручили подарунок. Увага й якість речі залишили помітне враження.",effects:{...item.effects,bond:1,affection:1,trust:1}},before);
  saveGame(false);
  render();
}
function findLegendaryItem(){
  if(Math.random()>=BALANCE.legendaryTravelChance) return;
  const personal=itemCatalog.filter(item=>item.loot && item.rarity==="legendary" && !hasUniqueItem(item.id));
  const household=homeItemCatalog.filter(item=>item.loot && item.rarity==="legendary" && homeStock(item.id)<1 && !rooms.some(room=>(room.furnishings||[]).includes(item.id)));
  const available=personal.concat(household);
  if(!available.length) return;
  const item=pick(available);
  if(homeItemById(item.id)) homeInventory[item.id]=1;
  else itemInventory[item.id]=1;
  const text="Під час подорожі знайдено легендарний предмет «"+item.name+"». "+(item.lore||item.desc||"Це рідкісна знахідка, яку не продають у звичайній крамниці.");
  log("🌟 "+text,"achievement");
  showInteractionEvent(null,{name:"Легендарна знахідка",scene:text,effects:{}},{});
  checkLegendaryAchievements();
}
function unequipGift(slot,personId){
  const person=findOwnedAny(personId);
  if(!person || !person.equipment[slot]) return;
  if(!requireCurrentNpc(person)) return;
  if(!consumeAction("зміна спорядження NPC")) return;
  const before=relationshipSnapshot(person);
  const id=person.equipment[slot];
  const item=itemById(id);
  if(item){
    removeItemEffects(person,slot,item);
    itemInventory[id]=itemStock(id)+1;
  }
  person.equipment[slot]=null;
  logAction("📦 "+profileName(person)+" повертає предмет «"+(item?item.name:"Річ")+"» у запас.","relation");
  showInteractionEvent(person,{name:"Повернення речі",scene:"Предмет було знято й повернуто до запасів торгового дому.",effects:item?item.effects:{}},before);
  saveGame(false);
  render();
}
function cargoUsed(){return Object.values(inventory).reduce((sum,qty)=>sum+qty,0);}
function warehouseCapacity(){
  const room=roomByKey("warehouse");
  const bonus=player&&player.warehouseBonus?player.warehouseBonus:0;
  if(!room.unlocked) return 10+bonus;
  const workers = assignedStaff("Склад").reduce((sum,person)=>sum+5+(person.trait.key==="organized"?3:0),0);
  return 10 + bonus + room.level*room.bonus + roomFurnitureBonus(room,"capacity") + workers;
}
function unassignedHouseResidents(){
  if(!hasHeadquarters()) return [];
  return ownedPeople().filter(person=>person.locationCity===player.headquartersCity && person.job==="Без роботи");
}
function freeHouseRooms(){
  const house=roomByKey("house");
  return Math.max(0,(house.freeRooms||0)-unassignedHouseResidents().length);
}
function nextHouseRoomCost(){
  const house=roomByKey("house");
  return 70+Math.pow((house.freeRooms||0)+1,2)*14;
}
function buildHouseRoom(){
  const house=roomByKey("house");
  if(!house || !requireHeadquartersPresence()) return;
  if((house.freeRooms||0)>=BALANCE.maxHouseRooms){log("❌ У домі торговця вже відкрито максимум кімнат для підлеглих.","system");render();return;}
  const cost=nextHouseRoomCost();
  if(gold<cost){log("❌ Для відкриття нової кімнати потрібно "+cost+" монет.","system");render();return;}
  if(!consumeAction("відкриття кімнати в домі")) return;
  gold-=cost;
  house.freeRooms=(house.freeRooms||0)+1;
  gainExperience(4,"розширення дому торговця");
  logAction("🛏️ Відкрито нову вільну кімнату в Домі торговця. Кімнат: "+house.freeRooms+" / "+BALANCE.maxHouseRooms+".","hq");
  saveGame(false);
  render();
}
function professionBonus(person,job){
  if(person.mastery===job) return 10;
  const title=jobTitle(job,false);
  return title && person.profession.includes(title)?5:0;
}
function workerPower(person,job,stat){
  const loyaltyBonus=Math.floor((person.loyalty||0)/5);
  const healthBonus=Math.floor((person.health||0)/5);
  const obedienceBonus=person.status==="slave"?Math.floor((person.obedience||0)/5):0;
  return person[stat]+professionBonus(person,job)+(person.status==="citizen"?2:0)+loyaltyBonus+healthBonus+obedienceBonus;
}
function staffIncomeForRoom(person,key){
  const room=roomByKey(key);
  const furniture=roomFurnitureBonus(room,"income");
  if(key==="forge"||key==="weaving"||key==="jewelry"||key==="furniture") return Math.floor(workerPower(person,room.job,"craft")*1.6)+room.level*2+furniture;
  if(key==="stable") return Math.floor(workerPower(person,room.job,"strength")*1.1)+room.level+furniture+Math.floor(farmFoodProduction(false)/3);
  if(key==="house") return Math.floor(workerPower(person,room.job,"craft")*0.8)+room.level+furniture;
  if(key==="inn") return Math.floor(workerPower(person,room.job,"service")*1.7)+room.level*2+furniture;
  return 0;
}
function dailyRoomIncome(key){
  const room=roomByKey(key);
  if(!hasHeadquarters() || !room || !room.unlocked || (key==="house" && !room.kitchenRestored)) return 0;
  const staff=room.job?assignedStaff(room.job):[];
  if(!staff.length) return 0;
  return staff.reduce((sum,person)=>sum+staffIncomeForRoom(person,key),0);
}
function headquartersIncome(){
  return ["forge","weaving","jewelry","furniture","stable","house","inn"].reduce((sum,key)=>sum+dailyRoomIncome(key),0);
}
function addItem(name,qty){inventory[name]=(inventory[name]||0)+qty;}
function removeItem(name,qty){
  if(inventoryCount(name)<qty) return false;
  inventory[name]-=qty;
  if(inventory[name]===0) delete inventory[name];
  return true;
}
function marketGood(cityIndex,name){return markets[cityIndex].goods.find(g=>g.name===name);}
function salePrice(cityIndex,name){
  const price = marketGood(cityIndex,name).sell;
  const reputationBonus = clamp(cityReputation(cityIndex),0,30) / 200;
  return Math.round(price*(1+reputationBonus));
}
function purchasePrice(cityIndex,name){
  return Math.max(1,Math.round(marketGood(cityIndex,name).buy*reputationPriceMultiplier(cityIndex)));
}
function bulkPurchasePrice(cityIndex,name,qty){
  const price=purchasePrice(cityIndex,name);
  return qty>=5?Math.max(1,Math.round(price*(1-BALANCE.bulkDiscount))):price;
}
function shopPrice(base,index=currentCity){
  return Math.max(1,Math.round(base*reputationPriceMultiplier(index)));
}
function npcPrice(person){
  return shopPrice(person.price||person.value||0,person.city);
}

function render(){
  document.getElementById("gold").innerText="💰 "+gold;
  document.getElementById("food").innerText="🍲 "+food;
  document.getElementById("day").innerText="📅 "+t("status.day")+" "+day;
  reputation=cityReputation(currentCity);
  document.getElementById("rep").innerText="⚖️ "+cityReputation(currentCity);
  document.getElementById("cityName").innerText="📍 "+cityName(currentCity);
  document.getElementById("heroLevel").innerText="⭐ "+t("status.level")+" "+playerLevel()+": "+rankName(rankInfo());
  document.getElementById("worldYear").innerHTML="🕰️ "+CAMPAIGN_YEAR+" "+t("status.year")+" "+seasonHeaderHtml();
  document.getElementById("capacity").innerText="📦 "+cargoUsed()+" / "+warehouseCapacity();
  document.getElementById("income").innerText="🏰 +"+headquartersIncome()+(lang==="en"?" / day":" / день");
  document.getElementById("energy").innerText="⚡ "+energy+" / "+dailyActionLimit()+" "+t("status.actions");
  const weekButton=document.getElementById("nextWeekButton");
  if(weekButton) weekButton.classList.toggle("hidden",playerLevel()<5);
  renderQuestDock();
  renderTab(activeTab);
  renderLog();
  renderActionHeroDock();
  if(activeNpcRequest) showNpcRequestNotice(); else hideNpcRequestNotice();
  collapseMobileDetails();
}
function collapseMobileDetails(){
  if(window.innerWidth>1050) return;
  document.querySelectorAll("details.npc-actions-toggle").forEach(d=>{if(!d.dataset.userOpened) d.open=false;});
}
function renderTab(tabId){
  const tabRenderers={
    market:renderMarket,
    square:renderSquare,
    travel:renderTravel,
    player:renderPlayerProfile,
    subordinates:renderOwned,
    profile:renderNpcProfile,
    caravan:renderRoutes,
    hq:()=>{renderRooms();renderFamilyRooms();},
    journal:renderLog,
    achievements:renderAchievements,
    help:renderHelp
  };
  (tabRenderers[tabId]||renderMarket)();
}
// === v0.43: Help / New player guide ===
const HELP_CONTENT={
  uk:[
    {h:"🎮 З чого починається гра",b:`<p>Ти — молодий торговець у 1205 році. Європа розколота на сотні князівств, церков і міст-комун. Сіль з Кракова цінується у Венеції, шовк з Константинополя — у Парижі, хутро з Києва — всюди.</p>
<p><b>Твоя мета:</b> з 1000 монет та одного імені побудувати торговий дім — найняти людей, заснувати штаб, налагодити маршрути, виховати майстрів. Жорстких сюжетних обмежень немає, кампанія відкрита.</p>`},
    {h:"💰 Ринок і торгівля — основа",b:`<p><b>Купуй дешево, продавай дорого</b> — старе як світ правило. Кожне місто має свої постачання й попит:</p>
<ul><li>Сіль → дешева в Кракові, дорога в Італії</li><li>Шовк → дешевий у Константинополі, дорогий у Лондоні</li><li>Хутро → дешеве у Києві/Новгороді, дороге всюди на заході</li></ul>
<p><b>Сезон важливий!</b> Зерно дорожчає навесні, хутро взимку, мед влітку. Шок-індикатори показують: 🔥 <i>Дефіцит 2д</i> — товар продаватиметься з націнкою ще 2 дні. 📉 <i>Надлишок 3д</i> — товар можна купити дешево.</p>
<p><b>Оптові ціни</b> (купити 5+) дають знижку. <b>Ринок не витрачає енергії</b> — торгуй скільки хочеш.</p>`},
    {h:"⚡ Енергія та день",b:`<p>Кожен день дає <b>7 дій</b>. Витрачаються на: подорож, наймання людей, гільдійні квести, взаємодії з NPC, призначення робіт у штабі.</p>
<p><b>Що НЕ витрачає дії:</b> торгівля на ринку, перегляд інформації, рух між табами.</p>
<p>Натисни <b>⏭️ Наступний день</b>, коли вичерпав сили — отримаєш звіт і відновлення енергії.</p>`},
    {h:"🧭 Подорожі та маршрути",b:`<p>Натисни на місто в таблі <b>Подорожі</b> — обери:</p>
<ul><li>🌲 <b>Лісом</b>: швидше на 1 день, дешевше на 10%, але +60% шансу засідки</li><li>🛣️ <b>Великим шляхом</b>: стандарт</li><li>⛰️ <b>Гірський перевал</b>: +1 день, +20% мита, але засідки -60%</li></ul>
<p><b>Бери супровід</b>: до 4 NPC з характеристикою "Бій". Без них ти втратиш товар у разі нападу.</p>`},
    {h:"⚔️ Бій (Darkest Dungeon style)",b:`<p>Зустрічі на дорозі ведуть до бою. Ти можеш обрати <b>Автоматичний</b> або <b>Ручний</b> режим у вікні подорожі.</p>
<p><b>Ранги 1-4</b>: передні юніти (1-2) б'ють +20% і отримують +30% шкоди. Задні (3-4) б'ють -20% і отримують -40%. <b>Розташовуй сильних попереду.</b></p>
<p><b>Скіли</b> залежать від характеристик:</p>
<ul><li>⚔️ <b>Удар</b> — усі</li><li>💥 <b>Розкол строю</b> (combat≥10): +60% шкоди</li><li>🎯 <b>Прицільний постріл</b> (combat≥8 + craft≥6): по задньому ворогу, +крит</li><li>➕ <b>Перев'язка</b> (service≥10): лікує союзника</li><li>🔥 <b>Шалена атака</b> (strength≥12): б'є 2 ворогів</li></ul>
<p><b>Стрес</b> накопичується від ран. При 100+ NPC може запанікувати й пропустити хід. Скидається на перемозі.</p>`},
    {h:"👥 Люди — головний капітал",b:`<p>У <b>Центрі зайнятості</b> можна найняти вільних людей (місячна зарплата) або купити підневільних (споживають їжу, не платять).</p>
<p>Призначай у штабі: 🔨 Кузня, 🧵 Ткацький цех, 💎 Ювелірна, 🪑 Меблева, 🌾 Ферма, 🍲 Кухня, 🏛️ Заїжджий двір, 📦 Склад, ⚔️ Тренування.</p>
<p><b>NPC мають характер</b>: раз на 10-18 днів подають прохання — відвідати рідне місто, нове спорядження, тренування, премія. Прийми → +лояльність. Ігноруй → -лояльність. Прохання гасне за 5 днів.</p>
<p><b>Раби</b> можуть просити свободу при лояльності ≥6. Звільни → стане найманцем.</p>`},
    {h:"🌱 Еволюція NPC: скіл-дрейф",b:`<p><b>Кожен призначений NPC щодня росте у профільному статі цеху</b>. Швидкість залежить від поточного рівня — у новачка зростання швидке (2 дні/пункт), у досвідченого повільне (5-6 днів/пункт).</p>
<p>У профілі NPC видно:</p>
<ul><li>★ <b>золотим</b> — основний стат цієї роботи</li><li>▲ <b>зеленим</b> — другорядний стат, теж росте</li><li>▼ <b>червоним</b> — стат атрофується (наприклад лояльність у Камері)</li><li>Прогрес-бар + % до наступного приросту</li></ul>
<p><b>Трейт-бонус</b>: якщо у NPC характеристика-вигоди збігається з основним статом цеху, ріст ×1.2.</p>
<p><b>Шлях до Майстра</b>: ~75-90 днів роботи в одному цеху → 12+ профільного статі.</p>`},
    {h:"🌟 Аспірації — особистий квест NPC",b:`<p>Поле «<i>мріє...</i>» у профілі тепер живе. Кожен NPC має <b>багатоетапний особистий квест</b>:</p>
<ul><li>🏪 <b>Власна майстерня</b> — craft 12 + 250 монет заробітку</li><li>👨‍👩‍👧 <b>Гроші для родини</b> — 400 монет заробітку</li><li>📚 <b>Опанувати ремесло</b> — 45 днів + craft 14</li><li>🏛️ <b>Побачити Венецію</b> — приведи його в Венецію</li><li>🏠 <b>Безпечне житло</b> — лояльність 12 + 30 днів</li><li>🏅 <b>Повага міста</b> — стат 15 + візит у рідне місто</li></ul>
<p>Коли всі кроки виконано, <b>⚡ NPC просить аудієнції</b> — з'являється плаваюча панель. Твої рішення мають <b>тривалі наслідки</b>:</p>
<ul><li>🎁 <b>Відпустити</b> — NPC залишає дім, але дає тобі <b>постійну знижку 10%</b> на ринку свого міста</li><li>🤝 <b>Партнерство</b> — заплати раз, отримуй +8 монет/день <b>назавжди</b></li><li>🔒 <b>Затримати</b> — NPC лишається з гіркотою, лояльність повільно падає</li></ul>
<p>Кожен NPC = <b>історія з закінченням</b>. Гравець ризикує втратити людину, але здобуває спадщину.</p>`},
    {h:"🏰 Штаб торгового дому",b:`<p>Засновується в одному місті — вибери розумно. Зі штабу йде <b>пасивний дохід</b> від робіт NPC.</p>
<p>Кімнати відкриваються поступово, потребують меблів (купуй у Крамниці). Чим краща обстановка — тим вища продуктивність.</p>
<p><b>Кухня</b> ключова: їжа потрібна рабам. Якщо їжі нема — обкатки здоров'я або втеча.</p>`},
    {h:"📜 Завдання гільдії та ради",b:`<p><b>Гільдія</b> платить монетами за доставку конкретних товарів. Швидкий прибуток.</p>
<p><b>Мерія</b> просить товари для міста, винагороджує предметами (меблі, спорядження для NPC).</p>
<p>Складніші квести відкриваються з рівнем героя. Виконання → +досвід + репутація.</p>`},
    {h:"💞 Стосунки й сім'я",b:`<p>10 рангів від "Ледь знайомі" до "Майже подружжя". Підвищуй через подарунки та взаємодії.</p>
<p>При найвищих рангах + приватна кімната → шлюб. Подружжя може мати дитину.</p>`},
    {h:"🏆 Досягнення",b:`<p>20+ досягнень: ранги кар'єри, відвідати всі 34 міста, повний штаб, легендарні предмети, перший шлюб, перша дитина...</p>
<p>Деякі приховані — їх потрібно відкрити дією.</p>`},
    {h:"💡 Поради для виживання",b:`<ul>
<li><b>Перший тиждень</b>: пройдись по 2-3 містах поряд, вивчи ціни. Не наймай людей одразу.</li>
<li><b>Зима</b> — золотий час для хутра й солі. Восени накопичуй запас.</li>
<li><b>Репутація</b> важлива: добра слава = краща ціна продажу, погана = більший шанс засідок (але інколи лякає розбійників).</li>
<li><b>Не залишай людей без зарплати</b>: 3 пропущені виплати = втеча.</li>
<li><b>Зберігайся часто</b> — кнопка "Зберегти" вгорі.</li>
</ul>`}
  ],
  en:[
    {h:"🎮 How the game begins",b:`<p>You are a young merchant in the year 1205. Europe is fractured into hundreds of principalities, churches and city communes. Salt from Kraków is valued in Venice, silk from Constantinople is prized in Paris, fur from Kyiv is sought everywhere in the west.</p>
<p><b>Your goal:</b> from 1000 coins and a single name, build a trading house — hire people, found a headquarters, establish routes, raise masters. There are no strict story constraints, the campaign is open.</p>`},
    {h:"💰 Market & trade — the foundation",b:`<p><b>Buy low, sell high</b> — the ancient rule. Each city has its own supply and demand:</p>
<ul><li>Salt → cheap in Kraków, expensive in Italy</li><li>Silk → cheap in Constantinople, expensive in London</li><li>Fur → cheap in Kyiv/Novgorod, expensive across the west</li></ul>
<p><b>Season matters!</b> Grain rises in spring, fur in winter, honey in summer. Shock indicators show: 🔥 <i>Shortage 2d</i> — the good sells at a premium for 2 more days. 📉 <i>Surplus 3d</i> — buy cheap now.</p>
<p><b>Bulk prices</b> (buy 5+) give a discount. <b>The market does not cost energy</b> — trade as much as you wish.</p>`},
    {h:"⚡ Energy & the day",b:`<p>Each day grants <b>7 actions</b>. Spent on: travel, hiring people, guild quests, NPC interactions, headquarters work assignments.</p>
<p><b>What does NOT cost actions:</b> market trading, viewing info, switching tabs.</p>
<p>Click <b>⏭️ Next day</b> when you have exhausted your strength — you'll get a chronicle and restored energy.</p>`},
    {h:"🧭 Travel & routes",b:`<p>Click a city in the <b>Travel</b> tab — choose your route:</p>
<ul><li>🌲 <b>Forest path</b>: -1 day, -10% cost, but +60% ambush chance</li><li>🛣️ <b>Highway</b>: standard</li><li>⛰️ <b>Mountain pass</b>: +1 day, +20% tolls, but ambushes -60%</li></ul>
<p><b>Bring an escort</b>: up to 4 NPCs with "combat" stat. Without them you'll lose your goods if attacked.</p>`},
    {h:"⚔️ Combat (Darkest Dungeon style)",b:`<p>Encounters on the road lead to combat. You can choose <b>Auto</b> or <b>Manual</b> mode in the travel window.</p>
<p><b>Ranks 1-4</b>: front units (1-2) deal +20% and take +30% damage. Back units (3-4) deal -20% and take -40%. <b>Place your strongest in front.</b></p>
<p><b>Skills</b> depend on NPC stats:</p>
<ul><li>⚔️ <b>Strike</b> — everyone</li><li>💥 <b>Cleave</b> (combat≥10): +60% damage</li><li>🎯 <b>Precise shot</b> (combat≥8 + craft≥6): hits the back enemy, +crit</li><li>➕ <b>Bandage</b> (service≥10): heals an ally</li><li>🔥 <b>Berserk</b> (strength≥12): hits 2 enemies</li></ul>
<p><b>Stress</b> builds from wounds. At 100+ an NPC may panic and miss a turn. Resets on victory.</p>`},
    {h:"👥 People — your main capital",b:`<p>In the <b>Employment centre</b> you can hire free people (monthly salary) or buy bonded ones (consume food, no pay).</p>
<p>Assign at the headquarters: 🔨 Smithy, 🧵 Weaving, 💎 Jewellery, 🪑 Joinery, 🌾 Farm, 🍲 Kitchen, 🏛️ Inn, 📦 Warehouse, ⚔️ Training.</p>
<p><b>NPCs have character</b>: once every 10-18 days they submit a request — visit home, new equipment, training, bonus. Accept → +loyalty. Ignore → -loyalty. The request expires after 5 days.</p>
<p><b>Slaves</b> may beg for freedom at loyalty ≥6. Free them → they become hirelings.</p>`},
    {h:"🌱 NPC evolution: skill drift",b:`<p><b>Every assigned NPC grows in the primary stat of their workshop every day</b>. The speed depends on their current level — a novice grows fast (2 days/point), a veteran slowly (5-6 days/point).</p>
<p>In the NPC profile you'll see:</p>
<ul><li>★ <b>gold</b> — primary stat of this job</li><li>▲ <b>green</b> — secondary stat that also grows</li><li>▼ <b>red</b> — stat decaying (e.g. loyalty in the Cell)</li><li>Progress bar + % to next point</li></ul>
<p><b>Trait bonus</b>: if the NPC's trait grants the same stat as the workshop's primary, growth ×1.2.</p>
<p><b>Path to Master</b>: ~75-90 days in one workshop → 12+ primary stat.</p>`},
    {h:"🌟 Aspirations — NPC personal quest",b:`<p>The "<i>dreams of...</i>" field in the profile is now alive. Each NPC has a <b>multi-step personal quest</b>:</p>
<ul><li>🏪 <b>Own workshop</b> — craft 12 + 250 coins earned</li><li>👨‍👩‍👧 <b>Money for family</b> — 400 coins earned</li><li>📚 <b>Master a craft</b> — 45 days + craft 14</li><li>🏛️ <b>See Venice</b> — bring them to Venice</li><li>🏠 <b>A safe home</b> — loyalty 12 + 30 days</li><li>🏅 <b>City respect</b> — best stat 15 + visit home city</li></ul>
<p>When all steps are met, <b>⚡ the NPC asks for an audience</b> — a floating panel appears. Your choices have <b>lasting consequences</b>:</p>
<ul><li>🎁 <b>Release</b> — NPC leaves your house but grants you a <b>permanent 10% market discount</b> in their hometown</li><li>🤝 <b>Partnership</b> — pay once, receive +8 coins/day <b>forever</b></li><li>🔒 <b>Detain</b> — NPC stays with bitterness, loyalty slowly drops</li></ul>
<p>Each NPC = <b>a story with an ending</b>. Risk losing a person, gain a legacy.</p>`},
    {h:"🏰 Trading house headquarters",b:`<p>Founded in one city — choose wisely. The HQ produces <b>passive income</b> from NPC work.</p>
<p>Rooms unlock gradually, require furniture (buy from the Shop). Better decor = higher productivity.</p>
<p><b>Kitchen</b> is critical: food is needed for slaves. No food → health loss or escape.</p>`},
    {h:"📜 Guild & city council quests",b:`<p><b>Guild</b> pays coins for delivering specific goods. Quick profit.</p>
<p><b>City council</b> asks for goods, rewards with items (furniture, NPC equipment).</p>
<p>Harder quests unlock with hero level. Completion → +XP + reputation.</p>`},
    {h:"💞 Relationships & family",b:`<p>10 ranks from "Barely acquainted" to "Almost married". Improve with gifts and interactions.</p>
<p>At highest rank + a private room → marriage. Spouses may have a child.</p>`},
    {h:"🏆 Achievements",b:`<p>20+ achievements: career ranks, visit all 34 cities, complete the HQ, legendary items, first marriage, first child...</p>
<p>Some are hidden — must be unlocked by action.</p>`},
    {h:"💡 Survival tips",b:`<ul>
<li><b>First week</b>: walk through 2-3 nearby cities, learn prices. Don't hire people right away.</li>
<li><b>Winter</b> is the golden time for fur and salt. Accumulate stock in autumn.</li>
<li><b>Reputation</b> matters: good fame = better sell prices, bad = more ambushes (but sometimes scares off bandits).</li>
<li><b>Never leave people unpaid</b>: 3 missed salaries = they flee.</li>
<li><b>Save often</b> — the "Save" button is at the top.</li>
</ul>`}
  ]
};
// === v0.43: Changelog ===
const CHANGELOG=[
  {version:"v0.44",date:"2026-06-04",entries:{
    uk:[
      {tag:"NEW",text:"Міська таверна на Площі: вечеря за 20 монет відновлює всі дії на день і відкриває чутку від місцевих про цирк / караван науковців / поселення ковалів."},
      {tag:"NEW",text:"Гра в кості в таверні: ставки 10/50/100. Можна грати в борг — але якщо нічим заплатити, місто оголошує тебе шахраєм, репутація падає до -20 і блокуються гільдія, мерія, таверна, найм і ринок рабів. Розблокувати — штраф 1000 монет."},
      {tag:"NEW",text:"Мерія міста винесена в окрему вкладку Площі поряд з гільдією — більше не плутаються контракти й доручення."},
      {tag:"NEW",text:"Фонові ілюстрації бою: окремий арт для нападів вовків (звірі) та розбійників."},
      {tag:"NEW",text:"Місця для арту у всіх локаціях Площі (гільдія, мерія, таверна, центр зайнятості, ринок рабів) та в Штабі."},
      {tag:"NEW",text:"Rewarded ads (тільки на CrazyGames): кнопка 🎁 Бонуси — за перегляд короткої реклами отримуєш +200 монет, +3 дії або повний рестокінг крамниці. Глобальний ліміт 3 нагороди/день."}
    ],
    en:[
      {tag:"NEW",text:"City tavern on the Square: a 20-coin dinner restores all daily actions and earns you a rumour from locals about the circus / scholars' caravan / smiths' settlement."},
      {tag:"NEW",text:"Tavern dice game: stakes 10/50/100. Playing on credit is allowed — but if you can't pay, the city brands you a cheat, reputation drops to -20, and the guild, town hall, tavern, hiring and slave market are locked. Unlock costs a 1000-coin fine."},
      {tag:"NEW",text:"Town hall moved to its own subtab on the Square next to the guild — contracts and council orders no longer overlap."},
      {tag:"NEW",text:"Combat backdrops: dedicated art for wolf (beasts) and bandit encounters."},
      {tag:"NEW",text:"Art slots in every Square location (guild, town hall, tavern, employment, slave market) and the HQ."},
      {tag:"NEW",text:"Rewarded ads (CrazyGames only): 🎁 Bonuses button — watch a short ad to get +200 coins, +3 actions, or a full shop restock. Global cap 3 rewards/day."}
    ]
  }},
  {version:"v0.43",date:"2026-06-02",entries:{
    uk:[
      {tag:"FIX",text:"Розширено пул жіночих портретів: усі 5 панелей атласу (female_01..female_05) тепер реально потрапляють у вільних NPC. Раніше випадково призначався лише female_01 — інші 4 ніколи не показувалися."},
      {tag:"FIX",text:"Перекаліброванні координати міст на мапі подорожі: тепер усі 34 крапки збігаються з реальним малюнком europe_1205.png."},
      {tag:"NEW",text:"Сладаюче меню та нижній док на десктопі — кнопка ⇔ зверху ліворуч переводить у компактний режим. Меню розгортається при наведенні курсора або тапі по ньому, при відведенні — стискається."}
    ],
    en:[
      {tag:"FIX",text:"Female portrait pool expanded: all 5 atlas panels (female_01..female_05) are now actually assigned to free NPCs. Previously only female_01 was rolled — the other 4 never appeared."},
      {tag:"FIX",text:"Re-calibrated all 34 city map points on the travel map: dots now line up with the real europe_1205.png."},
      {tag:"NEW",text:"Collapsible desktop side-nav and action-dock: the ⇔ button at top-left enters compact mode. Menus expand on mouse hover or tap, collapse when you move away."}
    ]
  }},
  {version:"v0.39",date:"2026-06-02",entries:{
    uk:[
      {tag:"FIX",text:"Великий прохід по перекладу: достіжки, бойовий UI (Завершіть бій, Ручний режим), реєстри подій (народження, смерть, шлюб, перемога/поразка в дорозі, замовлення гільдії/мерії, нові рівні, досвід), створення героя, заснування штабу, сімейні покої, повідомлення ринку — все тепер бінгвальне."},
      {tag:"FIX",text:"Загадкові квести цирку та каравану науковців також ховають винагороди й список потреб — лише через таверни."},
      {tag:"NEW",text:"14 чуток у тавернах по 14 містах: 5 для ковалів, 5 для науковців, 4 для цирку."}
    ],
    en:[
      {tag:"FIX",text:"Major translation pass: achievements, combat UI (Finish the fight, Manual mode), event logs (birth, death, marriage, road victory/defeat, guild/council orders, new levels, hero XP), character creation, founding HQ, family quarters, market messages — all bilingual now."},
      {tag:"FIX",text:"Cryptic quests for the circus and scholars' caravan also hide rewards and the need list — discovered only through tavern rumours."},
      {tag:"NEW",text:"14 tavern rumours across 14 cities: 5 for smiths, 5 for scholars, 4 for circus."}
    ]
  }},
  {version:"v0.38",date:"2026-05-31",entries:{
    uk:[
      {tag:"NEW",text:"Вітальна сторінка з вибором мови (🇺🇦/🇬🇧) для нових гравців — показується перед створенням героя на першому запуску."},
      {tag:"UX",text:"Модальні вікна тепер прокручуються на маленьких екранах (overflow-y:auto), додатковий padding для мобільних."},
      {tag:"UX",text:"Ринок: товари у складі гравця підсвічуються золотою рамкою з лічильником, угорі — швидка стрічка інвентарю."},
      {tag:"NEW",text:"48 PNG-плейсхолдерів для всіх предметів і меблів (раніше показували лише emoji-fallback)."}
    ],
    en:[
      {tag:"NEW",text:"Welcome screen with language choice (🇺🇦/🇬🇧) for new players — shown before character creation on first launch."},
      {tag:"UX",text:"Modal windows now scroll on small screens (overflow-y:auto), extra padding for mobile."},
      {tag:"UX",text:"Market: goods in player's stock are highlighted with a gold frame and counter; quick inventory strip at the top."},
      {tag:"NEW",text:"48 PNG placeholders for all items and furniture (previously only emoji-fallback was shown)."}
    ]
  }},
  {version:"v0.37",date:"2026-05-31",entries:{
    uk:[
      {tag:"NEW",text:"Масштабний англійський переклад UI: картки NPC (стати Str/Crf/Cmb/Svc/Loy/Obd/Hp, бейджі, дії), Employment centre, Retinue (працівники й раби), профіль NPC (всі блоки), стосунки й діалоги, ефекти взаємодій, Shop та Guild quests, кнопки роботи та статусів."},
      {tag:"FIX",text:"Кнопки призначення на роботу, gift/relations/profile дії, status changes (Make a serf / Free as citizen / Execute), career hints — все двомовне."}
    ],
    en:[
      {tag:"NEW",text:"Major English translation pass: NPC cards (Str/Crf/Cmb/Svc/Loy/Obd/Hp stats, badges, actions), Employment centre, Retinue (workers and bonded), NPC profile (all blocks), relations & dialog, interaction effects, Shop and Guild quests, work-assignment and status buttons."},
      {tag:"FIX",text:"All assignment buttons, gift/relations/profile actions, status changes (Make a serf / Free as citizen / Execute), career hints — bilingual."}
    ]
  }},
  {version:"v0.36",date:"2026-05-31",entries:{
    uk:[
      {tag:"NEW",text:"Атмосферні зображення для прихованих місць: 🌿 Лавка ворожки, 🔨 Таємне поселення ковалів, 📚 Караван науковців, 🎪 Бродячий цирк."}
    ],
    en:[
      {tag:"NEW",text:"Atmospheric banners for hidden encounters: 🌿 Witch's shack, 🔨 Smiths' settlement, 📚 Scholars' caravan, 🎪 Wandering circus."}
    ]
  }},
  {version:"v0.35",date:"2026-05-31",entries:{
    uk:[
      {tag:"FIX",text:"У вікні стосунків і діалогу результат взаємодії з'являвся поза активним вікном (overlap двох модалок). Тепер модалка стосунків закривається перед показом результату."},
      {tag:"FIX",text:"Жіночі портрети тепер показуються у профілі NPC, бойовій арені (DD + legacy) і кадрах combat-report."}
    ],
    en:[
      {tag:"FIX",text:"In the relationship & dialog window, the interaction result appeared outside the active modal (two modals overlapping). The relationship modal is now closed before showing the result."},
      {tag:"FIX",text:"Female portraits now show in the NPC profile, combat arena (DD + legacy) and combat-report frames."}
    ]
  }},
  {version:"v0.34",date:"2026-05-31",entries:{
    uk:[
      {tag:"UX",text:"Після завершення подорожі додано кнопку «✓ Завершити подорож» — повідомлення тепер не закривається автоматично, гравець може спокійно прочитати лог подорожі."},
      {tag:"UX",text:"Кнопка «Пропустити» приховується після прибуття, замість неї з'являється пульсуюча зелена кнопка завершення."}
    ],
    en:[
      {tag:"UX",text:"After travel completion a '✓ Finish journey' button is shown — the message no longer auto-closes, the player can read the travel log at their own pace."},
      {tag:"UX",text:"The 'Skip' button hides after arrival, replaced by a pulsing green finish button."}
    ]
  }},
  {version:"v0.33",date:"2026-05-31",entries:{
    uk:[
      {tag:"FIX",text:"Бій з'являвся одразу при підтвердженні подорожі, навіть якщо мав статися на 3-й день. Тепер confirmTravel асинхронний: анімація крокує день за днем, а бій з'являється точно у потрібний день із прикриваючим повідомленням «⚔️ Біля стежки промайнули постаті...»."},
      {tag:"FIX",text:"resolveRoadCombat тепер повертає Promise, що дозволяє awaitити завершення бою у async-потоці подорожі."},
      {tag:"NEW",text:"Інкрементальна анімація подорожі: 🌅 День N у дорозі, потім події, потім (опціонально) бій із прихованням overlay, потім наступний день."}
    ],
    en:[
      {tag:"FIX",text:"Combat appeared immediately when player confirmed travel, even if it was supposed to happen on day 3. confirmTravel is now async: the animation steps day by day, and combat appears on its actual day with a setup line '⚔️ Figures move beside the path...'."},
      {tag:"FIX",text:"resolveRoadCombat now returns a Promise so the async travel flow can await combat completion."},
      {tag:"NEW",text:"Incremental travel animation: 🌅 Day N on the road, then events, then (optional) combat with overlay hide, then next day."}
    ]
  }},
  {version:"v0.32",date:"2026-05-31",entries:{
    uk:[
      {tag:"FIX",text:"Критичний баг бою: у ручному режимі після переходу на новий раунд turnPos скидався на 0 без перевірки чи юніт живий — мертві NPC «продовжували битися». Виправлено пошуком наступного живого учасника з захистом від нескінченного циклу."},
      {tag:"FIX",text:"Додатковий захист від мертвих акторів у ddManualUseSkill та ddRunAutoCombat (defense-in-depth)."}
    ],
    en:[
      {tag:"FIX",text:"Critical combat bug: in manual mode, when turnPos wrapped to a new round it didn't check if the unit was alive — dead NPCs would 'keep fighting'. Fixed by skipping to the next alive participant with a hard safety cap."},
      {tag:"FIX",text:"Defensive guards in ddManualUseSkill and ddRunAutoCombat against dead actors taking turns."}
    ]
  }},
  {version:"v0.31",date:"2026-05-31",entries:{
    uk:[
      {tag:"NEW",text:"3 рівні складності: 🌱 Легко (більше грошей/дій, м'якші покарання), ⚖️ Звичайно, ⚔️ Складно (жорстокий ринок, лютіші вороги). Вибирається при створенні героя."},
      {tag:"NEW",text:"Сейв-слоти: збереження гри у кілька названих слотів через UI «💾 Слоти», з датою, ім'ям героя, золотом і рівнем складності."},
      {tag:"NEW",text:"5 нових жіночих портретів для вільних NPC через панель арту."},
      {tag:"NEW",text:"Картинки маршрутів у виборі подорожі (ліс / шлях / гори)."},
      {tag:"NEW",text:"Кнопки закриття вікна подорожі: ✕ круглий зверху + великий «✕ Скасувати подорож» знизу."}
    ],
    en:[
      {tag:"NEW",text:"3 difficulty levels: 🌱 Easy (more gold/actions, gentler penalties), ⚖️ Normal, ⚔️ Hard (brutal market, fiercer enemies). Selected at character creation."},
      {tag:"NEW",text:"Save slots: save the game to multiple named slots via the «💾 Slots» UI, with date, hero name, gold and difficulty."},
      {tag:"NEW",text:"5 new female portraits for free NPCs via a single panel atlas."},
      {tag:"NEW",text:"Route imagery in the travel picker (forest / highway / mountains)."},
      {tag:"NEW",text:"Travel modal close buttons: round ✕ at top + large 'Cancel travel' button at bottom."}
    ]
  }},
  {version:"v0.30",date:"2026-05-31",entries:{
    uk:[
      {tag:"NEW",text:"Скіл-дрейф NPC: щодня плавне зростання профільного статі цеху з уповільненням на високих рівнях. Видимий ★/▲/▼ прогрес-бар у профілі."},
      {tag:"NEW",text:"Аспірації NPC: 6 особистих квестів на основі поля «мріє...». Резолюція з тривалими наслідками (постійні знижки, +монет/день назавжди, або гіркий розкол)."},
      {tag:"NEW",text:"aspirationFlags зберігаються між подорожами — відмітка «побув у Венеції» лишається навіки."},
      {tag:"NEW",text:"Постійні знижки на ринках міст, де колишні підопічні відкрили майстерні."},
      {tag:"FIX",text:"Заміна агресивного +1/день у цехах на плавний дрейф з трейт-бонусом ×1.2."}
    ],
    en:[
      {tag:"NEW",text:"NPC skill drift: smooth daily growth in workshop's primary stat, with diminishing returns at higher levels. Visible ★/▲/▼ progress bars in profile."},
      {tag:"NEW",text:"NPC aspirations: 6 personal quests based on the 'dreams of...' field. Resolution with lasting consequences (permanent discounts, +coins/day forever, or bitter detention)."},
      {tag:"NEW",text:"aspirationFlags persist across travels — visiting Venice as a companion is remembered forever."},
      {tag:"NEW",text:"Permanent market discounts in cities where released NPCs opened their own workshops."},
      {tag:"FIX",text:"Replaced aggressive +1/day workshop growth with smooth drift + trait bonus ×1.2."}
    ]
  }},
  {version:"v0.29",date:"2026-05-30",entries:{
    uk:[
      {tag:"NEW",text:"Сезони (Весна/Літо/Осінь/Зима) з модифікаторами цін; видимий лічильник у заголовку."},
      {tag:"NEW",text:"Вибір маршруту: 🌲 Лісом / 🛣️ Великим шляхом / ⛰️ Гірський перевал з різними ризиками."},
      {tag:"NEW",text:"Прохання NPC: відвідати рідне місто, нове спорядження, тренування, премія, свобода."},
      {tag:"NEW",text:"Бій у стилі Darkest Dungeon: ранги 1-4, 5 скілів (Удар/Розкол/Прицільний/Перев'язка/Шалена), стрес із панікою."},
      {tag:"NEW",text:"Художня нарація бою — 80+ фраз у двох мовах."},
      {tag:"NEW",text:"Художній літопис дня — згруповані абзаци з атмосферним обрамленням за сезоном і станом гравця."},
      {tag:"NEW",text:"Анімація подорожі між містами з кадровою прозою подій."},
      {tag:"NEW",text:"Підказка джерела закупівлі в активних квестах: квестове + найдешевша альтернатива."},
      {tag:"NEW",text:"Повний англійський переклад UI, прози бою й гайду нового гравця."},
      {tag:"NEW",text:"Розгорнутий гайд із 11 розділів."},
      {tag:"NEW",text:"Фавікон (вбудований SVG-замок)."},
      {tag:"UX",text:"Стиснутий мобільний інтерфейс: верх 95px (було 280px), низ 50px (було 285px)."},
      {tag:"UX",text:"Повноекранна арена бою з художньою прозою — без скролу."},
      {tag:"FIX",text:"ZIP-архів з forward-слешами для коректного розпакування Netlify (Linux)."}
    ],
    en:[
      {tag:"NEW",text:"Seasons (Spring/Summer/Autumn/Winter) with price modifiers; visible countdown in header."},
      {tag:"NEW",text:"Route choice: 🌲 Forest path / 🛣️ Highway / ⛰️ Mountain pass with distinct risk profiles."},
      {tag:"NEW",text:"NPC requests: home visit, new equipment, training, bonus, freedom for slaves."},
      {tag:"NEW",text:"Darkest Dungeon-style combat: ranks 1-4, 5 skills (Strike/Cleave/Precise/Bandage/Berserk), stress with panic."},
      {tag:"NEW",text:"Artistic combat narration — 80+ phrases in both languages."},
      {tag:"NEW",text:"Artistic day chronicle — grouped prose paragraphs framed by season and player state."},
      {tag:"NEW",text:"Travel animation between cities with frame-by-frame event prose."},
      {tag:"NEW",text:"Buy-source hint in active quests: quest's intended source + cheapest alternative."},
      {tag:"NEW",text:"Full English translation of UI, combat prose and new-player guide."},
      {tag:"NEW",text:"Expanded 11-section player guide."},
      {tag:"NEW",text:"Favicon (inline SVG castle)."},
      {tag:"UX",text:"Compact mobile UI: top 95px (was 280px), bottom 50px (was 285px)."},
      {tag:"UX",text:"Fullscreen combat arena with artistic prose — no scrolling required."},
      {tag:"FIX",text:"ZIP archive uses forward-slash paths so Netlify (Linux) unpacks correctly."}
    ]
  }},
  {version:"v0.28",date:"earlier",entries:{
    uk:[
      {tag:"NEW",text:"Слоти зброї та броні NPC."},
      {tag:"NEW",text:"Приховані місця у подорожах (ворожка, циркачі, схолари, ковалі)."},
      {tag:"NEW",text:"Еліксир життя (рятує NPC від смерті в бою)."},
      {tag:"NEW",text:"Оптові ціни на ринку (купити 5+)."},
      {tag:"NEW",text:"Пропуск тижня з 5 рівня."},
      {tag:"NEW",text:"Двомовність UI (UK/EN)."}
    ],
    en:[
      {tag:"NEW",text:"NPC weapon and armor slots."},
      {tag:"NEW",text:"Hidden travel encounters (witch, circus, scholars, smiths)."},
      {tag:"NEW",text:"Life elixir (saves an NPC from death in combat)."},
      {tag:"NEW",text:"Bulk market prices (buy 5+)."},
      {tag:"NEW",text:"Skip-a-week from level 5."},
      {tag:"NEW",text:"Bilingual UI (UK/EN)."}
    ]
  }}
];
function renderChangelog(){
  const intro=tr(
    "Літопис змін усіх версій. Найновіші зверху.",
    "Chronicle of changes across all versions. Newest first."
  );
  try{
    const html=CHANGELOG.map(v=>{
      const entries=(v.entries&&(v.entries[lang]||v.entries.uk)||[]).map(e=>{
        const tagCls=e.tag==="NEW"?"changelog-tag-new":e.tag==="FIX"?"changelog-tag-fix":"changelog-tag-ux";
        return `<li><span class="changelog-tag ${tagCls}">${e.tag||""}</span> ${e.text||""}</li>`;
      }).join("");
      return `<div class="changelog-version"><h3>${v.version||"?"} <span class="changelog-date">${v.date||""}</span></h3><ul>${entries}</ul></div>`;
    }).join("");
    return `<div class="changelog-shell"><p class="changelog-intro">${intro}</p>${html}</div>`;
  }catch(e){
    console.error("renderChangelog failed:",e);
    return `<div class="changelog-shell"><p class="changelog-intro">${intro}</p><p style="color:#cd5148">⚠ Render error: ${escapeHtml(e.message)}</p></div>`;
  }
}

let currentHelpTab="guide";
function renderHelp(which=currentHelpTab){
  const target=document.getElementById("helpContent");
  if(!target) return;
  currentHelpTab=which==="changelog"?"changelog":"guide";
  const content=HELP_CONTENT[lang]||HELP_CONTENT.uk;
  const versionLine=tr(
    `Поточна версія: <b>v0.44</b> — таверна (вечеря+кості+чутки), мерія окремою вкладкою, фонові ілюстрації бою, rewarded ads.`,
    `Current version: <b>v0.44</b> — tavern (dinner+dice+rumours), town hall as a separate tab, combat backdrops, rewarded ads.`
  );
  const tabs=`<div class="help-tabs"><button type="button" class="help-tab ${currentHelpTab==="guide"?"active":""}" data-help-tab="guide" aria-pressed="${currentHelpTab==="guide"}" onclick="switchHelpTab(this,'guide')">${tr("📖 Гайд","📖 Guide")}</button><button type="button" class="help-tab ${currentHelpTab==="changelog"?"active":""}" data-help-tab="changelog" aria-pressed="${currentHelpTab==="changelog"}" onclick="switchHelpTab(this,'changelog')">${tr("📜 Літопис змін","📜 Changelog")}</button></div>`;
  const guide=`<div id="helpTabGuide" class="help-tab-content ${currentHelpTab==="guide"?"active":""}"><div class="help-grid">`+content.map(item=>`<div class="profile-block help-card"><h3>${item.h}</h3>${item.b}</div>`).join("")+`</div></div>`;
  const changelog=`<div id="helpTabChangelog" class="help-tab-content ${currentHelpTab==="changelog"?"active":""}">${renderChangelog()}</div>`;
  target.innerHTML=`<div class="help-version">${versionLine}</div>${tabs}${guide}${changelog}`;
}
function switchHelpTab(btn,which){
  currentHelpTab=which==="changelog"?"changelog":"guide";
  document.querySelectorAll(".help-tab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".help-tab").forEach(b=>b.setAttribute("aria-pressed","false"));
  if(btn){
    btn.classList.add("active");
    btn.setAttribute("aria-pressed","true");
  }
  document.querySelectorAll(".help-tab-content").forEach(c=>c.classList.remove("active"));
  const tgt=document.getElementById("helpTab"+which.charAt(0).toUpperCase()+which.slice(1));
  if(tgt) tgt.classList.add("active");
  else renderHelp(currentHelpTab);
}

function renderAchievements(){
  const target=document.getElementById("achievementList");
  if(!target) return;
  const unlocked=achievementCatalog.filter(item=>achievementUnlocked(item.id)).length;
  target.innerHTML=`<div class="achievement-summary">${tr("Відкрито","Unlocked")}: <b>${unlocked} / ${achievementCatalog.length}</b></div>`+achievementCatalog.map(item=>{
    const state=achievements&&achievements[item.id];
    if(!state) return `<div class="achievement-card locked"><div class="achievement-art achievement-unknown">?</div><div><h3>???</h3><p>${tr("Досягнення ще не відкрито. Умова прихована.","Not yet unlocked. Condition is hidden.")}</p><span class="badge">${tr("Таємниця","Mystery")}</span></div></div>`;
    return `<div class="achievement-card unlocked"><div class="achievement-art">${achievementSprite(item.id)}</div><div><h3>${escapeHtml(achievementTitle(item))}</h3><p>${escapeHtml(achievementDesc(item))}</p><span class="badge">${tr("Отримано в день","Earned on day")} ${state.day}</span></div></div>`;
  }).join("");
}

function renderWarehouse(){
  const goods = Object.entries(inventory).filter(entry=>entry[1]>0);
  const upkeep = dailyUpkeep();
  const list = goods.length ? goods.map(([name,qty])=>goodsLine(name,qty)).join("") : `<div class="empty">${lang==="en"?"Warehouse is empty. Buy goods at the market.":"Склад порожній. Купи товар на ринку."}</div>`;
  const monthly=ownedHirelings.reduce((sum,person)=>sum+monthlyPayrollAmount(person),0);
  const net=headquartersIncome()-upkeep;
  const note=lang==="en"
    ? `Capacity: <b>${cargoUsed()} / ${warehouseCapacity()}</b><br>Food: <b>${food}</b>. Slaves consume <b>${ownedSlaves.length*BALANCE.slaveFoodPerDay}</b> / day.<br>Headquarters income next day: <b>+${headquartersIncome()}</b><br>Monthly wages to retinue: <b>-${monthly}</b> every 30 days.<br>Net daily HQ balance: <b>${net>=0?"+":""}${net}</b>.`
    : `Місткість: <b>${cargoUsed()} / ${warehouseCapacity()}</b><br>Їжа: <b>${food}</b>. Раби споживають <b>${ownedSlaves.length*BALANCE.slaveFoodPerDay}</b> / день.<br>Дохід штабу наступного дня: <b>+${headquartersIncome()}</b><br>Місячна платня підлеглим: <b>-${monthly}</b> кожні 30 днів.<br>Чистий денний баланс штабу: <b>${net>=0?"+":""}${net}</b>.`;
  document.getElementById("warehouseSummary").innerHTML=list+`<div class="economy-note">${note}</div>`+rumorPanelHtml();
}

function priceTrendBadge(g){
  const parts=[];
  if(g.shockDays>0 && g.shockType==="shortage") parts.push(`<span class="badge trend-up">🔥 ${t("trend.shortage")} ${g.shockDays}д</span>`);
  if(g.shockDays>0 && g.shockType==="glut") parts.push(`<span class="badge trend-down">📉 ${t("trend.glut")} ${g.shockDays}д</span>`);
  const seasonMod=seasonModifier(g.name);
  if(seasonMod>=1.15) parts.push(`<span class="badge trend-up season-up" title="Сезонна націнка ${Math.round((seasonMod-1)*100)}%">${currentSeason().icon} +${Math.round((seasonMod-1)*100)}%</span>`);
  else if(seasonMod<=0.9) parts.push(`<span class="badge trend-down season-down" title="Сезонна знижка ${Math.round((1-seasonMod)*100)}%">${currentSeason().icon} -${Math.round((1-seasonMod)*100)}%</span>`);
  if(!g.shockDays){
    const anchor=marketAnchor(g);
    if(g.buy>=anchor*1.12) parts.push(`<span class="badge trend-up">${t("trend.expensive")}</span>`);
    else if(g.buy<=anchor*0.9) parts.push(`<span class="badge trend-down">${t("trend.cheap")}</span>`);
  }
  return parts.join("");
}

function renderMarket(){
  // v0.43: try to reveal a tavern rumour on each market visit (chance-based)
  maybeRevealRumor();
  const city=cities[currentCity];
  const profile=cityProfile(currentCity);
  document.getElementById("marketCity").innerText="📍 "+cityName(currentCity);
  document.getElementById("cityPortrait").innerHTML=`<div class="location-art city-card-art"><img src="assets/cities/${cityArtKeys[currentCity]}.png" onerror="this.style.display='none'"><span class="art-placeholder"></span></div>`;
  const factLabels=lang==="en"?["Founded","Population","Religion","Authority"]:["Заснування","Населення","Релігія","Влада"];
  const factNote=lang==="en"?"In-game historical note: population figures are approximate for the early 12th century.":"Ігрова історична довідка: чисельність наведена орієнтовно для початку XII століття.";
  document.getElementById("cityFacts").innerHTML=`<div class="city-facts"><b>${cityName(currentCity)}, ${regionName(city.region)}</b><span>${factLabels[0]}: <b>${profile[0]}</b></span><span>${factLabels[1]}: <b>${profile[1]}</b></span><span>${factLabels[2]}: <b>${profile[2]}</b></span><span>${factLabels[3]}: <b>${profile[3]}</b></span><span><b>${reputationLabel(currentCity)}</b></span><small>${factNote}</small></div>`;
  document.getElementById("marketHint").innerText=cityHint(city)+(lang==="en"?" Buying and selling are available only at this local market.":" Купівля і продаж доступні тільки на цьому місцевому ринку.");
  // v0.43: inventory strip above goods grid
  const ownedItems=Object.entries(inventory||{}).filter(e=>e[1]>0);
  let invStrip="";
  if(ownedItems.length){
    const chips=ownedItems.map(([name,qty])=>{
      const sell=salePrice(currentCity,name);
      return `<span class="market-inventory-chip" title="${tr("Продати в ","Sell in ")+cityName(currentCity)+": 💰"+sell+tr("/шт.","/pc")}">${goodThumb(name)}<b>${qty}×</b> ${escapeHtml(goodName(name))}</span>`;
    }).join("");
    invStrip=`<div class="market-inventory-strip"><span class="inv-label">📦 ${tr("Маєш зараз","Your stock")}:</span>${chips}</div>`;
  }else{
    invStrip=`<div class="market-inventory-strip"><span class="market-inventory-empty">${tr("📦 Склад порожній — купи товар нижче.","📦 Warehouse empty — buy goods below.")}</span></div>`;
  }
  document.getElementById("goods").innerHTML=invStrip+markets[currentCity].goods.filter(g=>!["Зброя","Обладунки"].includes(g.name)).map(g=>{
    const owned=inventoryCount(g.name);
    const sell=salePrice(currentCity,g.name);
    const buy=purchasePrice(currentCity,g.name);
    const bulk=bulkPurchasePrice(currentCity,g.name,5);
    const hasStock=owned>0?"has-stock":"";
    const counter=owned>0?`<div class="have-counter">${owned}×</div>`:"";
    return `<div class="card market-good ${hasStock}">${counter}<div class="good-art">${goodSprite(g.name)}</div><div class="card-title"><b>${goodName(g.name)}</b><span class="badge">${t("badge.stock")}: ${g.stock}</span>${priceTrendBadge(g)}</div><div><span class="badge">${t("badge.buy")}: 💰 ${buy}</span><span class="badge">${t("badge.bulk")}: 💰 ${bulk}</span><span class="badge">${t("badge.sell")}: 💰 ${sell}</span><span class="badge">${t("badge.have")}: ${owned}</span></div><div class="trade-actions"><button class="btn green" onclick="buyItem('${g.name}',1)">${t("trade.buy1")}</button><button class="btn green" onclick="buyItem('${g.name}',5)">${t("trade.buy5")}</button><button class="btn blue" onclick="sellItem('${g.name}',1)">${t("trade.sell1")}</button><button class="btn blue" onclick="sellItem('${g.name}',${owned})">${t("trade.sell_all")}</button></div></div>`;
  }).join("");
  renderWarehouse();
}

function renderTravel(){
  const hint=document.getElementById("travelPageHint");
  const grid=document.getElementById("travelGrid");
  if(!hint || !grid) return;
  renderTravelMap();
  const availableGuards=eligibleTravelCompanions(currentCity).length;
  hint.innerHTML=lang==="en"
    ? `You are in the city of <b>${cityName(currentCity)}</b>. Choose a destination, then pick your escort. Without subordinates the merchant cannot raid caravans and, if attacked on the road, loses automatically and forfeits the goods. People available for the road: <b>${availableGuards}</b>.`
    : `Ти перебуваєш у місті <b>${cityName(currentCity)}</b>. Обери напрямок, потім визнач супровід. Без підлеглих торговець не може нападати на каравани, а в разі нападу на дорозі автоматично програє і втрачає товар. Доступно людей для дороги: <b>${availableGuards}</b>.`;
  grid.innerHTML=cities.map((city,index)=>{
    if(index===currentCity) return "";
    const cost=travelCost(index);
    const days=travelDaysBetween(currentCity,index);
    const timeLbl=lang==="en"?`Time: ${days} d.`:`Час: ${days} дн.`;
    const costLbl=lang==="en"?`Cost: ${cost}`:`Витрати: ${cost}`;
    const pick=lang==="en"?"Choose route":"Обрати маршрут";
    return `<div class="card travel-card"><div class="travel-card-art"><img src="assets/cities/${cityArtKeys[index]}.png" onerror="this.style.display='none'"></div><div><div class="card-title"><b>${escapeHtml(cityName(index))}</b><span class="badge">${escapeHtml(regionName(city.region))}</span></div><span class="badge">${timeLbl}</span><span class="badge">${costLbl}</span><span class="badge">${escapeHtml(reputationLabel(index))}</span><p>${escapeHtml(cityHint(city))}</p></div><div class="trade-actions"><button class="btn green" onclick="prepareTravel(${index})">${pick}</button></div></div>`;
  }).join("");
}

// v0.43+: calibrated overlay coordinates for assets/map/europe_1205.png.
const cityMapPoints = [
  {x:62.5,y:37.5}, // Krakow
  {x:87.5,y:39.0}, // Kyiv
  {x:55.0,y:51.0}, // Venice
  {x:55.0,y:38.0}, // Prague
  {x:26.5,y:25.5}, // London
  {x:27.5,y:18.0}, // York
  {x:37.5,y:38.5}, // Paris
  {x:35.0,y:36.0}, // Rouen
  {x:40.0,y:32.0}, // Bruges
  {x:41.0,y:33.0}, // Ghent
  {x:44.0,y:35.5}, // Cologne
  {x:45.0,y:38.0}, // Mainz
  {x:50.0,y:41.0}, // Regensburg
  {x:55.5,y:44.5}, // Vienna
  {x:52.0,y:45.0}, // Salzburg
  {x:50.5,y:49.5}, // Milan
  {x:50.0,y:54.0}, // Genoa
  {x:52.5,y:56.0}, // Pisa
  {x:54.0,y:56.5}, // Florence
  {x:56.5,y:60.5}, // Rome
  {x:53.0,y:55.0}, // Bologna
  {x:83.0,y:65.0}, // Constantinople
  {x:71.0,y:68.0}, // Thessaloniki
  {x:76.0,y:18.5}, // Novgorod
  {x:78.0,y:32.0}, // Smolensk
  {x:74.5,y:27.0}, // Polotsk
  {x:46.5,y:28.0}, // Hamburg
  {x:45.0,y:29.5}, // Bremen
  {x:42.0,y:31.5}, // Utrecht
  {x:38.0,y:64.0}, // Barcelona
  {x:25.5,y:72.5}, // Toledo
  {x:22.5,y:78.0}, // Cordoba
  {x:20.5,y:80.5}, // Seville
  {x:12.5,y:75.0}  // Lisbon
];
const cityLabelOffsets = [
  {x:-10,y:-30}, // Krakow
  {x:10,y:-30}, // Kyiv
  {x:12,y:16}, // Venice
  {x:-18,y:-28}, // Prague
  {x:-24,y:16}, // London
  {x:8,y:-30}, // York
  {x:-18,y:16}, // Paris
  {x:-58,y:-8}, // Rouen
  {x:-22,y:-30}, // Bruges
  {x:12,y:16}, // Ghent
  {x:18,y:-30}, // Cologne
  {x:16,y:16}, // Mainz
  {x:20,y:-28}, // Regensburg
  {x:18,y:-30}, // Vienna
  {x:-58,y:12}, // Salzburg
  {x:-44,y:-24}, // Milan
  {x:-50,y:14}, // Genoa
  {x:-44,y:16}, // Pisa
  {x:14,y:-28}, // Florence
  {x:18,y:16}, // Rome
  {x:18,y:14}, // Bologna
  {x:20,y:-30}, // Constantinople
  {x:18,y:16}, // Thessaloniki
  {x:18,y:-30}, // Novgorod
  {x:18,y:16}, // Smolensk
  {x:-58,y:-16}, // Polotsk
  {x:10,y:-30}, // Hamburg
  {x:-54,y:8}, // Bremen
  {x:-58,y:-18}, // Utrecht
  {x:16,y:-30}, // Barcelona
  {x:12,y:-30}, // Toledo
  {x:-42,y:16}, // Cordoba
  {x:16,y:16}, // Seville
  {x:-18,y:16}  // Lisbon
];
const hiddenMapPoints = {
  witch:{x:49,y:73,icon:"✦"},
  smiths:{x:69,y:30,icon:"⚒"},
  circus:{x:43,y:48,icon:"✹"},
  scholars:{x:58,y:50,icon:"✧"}
};
function cityMapPoint(index){
  return cityMapPoints[validCityIndex(index,0)] || {x:50,y:50};
}
function cityLabelOffset(index){
  return cityLabelOffsets[validCityIndex(index,0)] || {x:0,y:14};
}
function hiddenMapPoint(key){
  return hiddenMapPoints[key] || {x:50,y:50};
}
function html5TravelMapBackdrop(){
  return `<img class="travel-map-bg travel-map-image" src="assets/map/europe_1205.png" alt="" aria-hidden="true">`;
}
function travelMapMarkerHtml(index,withLabel=true){
  const point=cityMapPoint(index);
  const label=cityLabelOffset(index);
  const destination=Number.isInteger(selectedTravelDestination) && selectedTravelDestination!==currentCity ? selectedTravelDestination : null;
  const cls=["map-city-dot"];
  if(index===currentCity) cls.push("current");
  if(index===destination) cls.push("selected");
  return `<button class="${cls.join(" ")}" style="left:${point.x}%;top:${point.y}%;--label-x:${label.x}px;--label-y:${label.y}px" onclick="prepareTravel(${index})" title="${escapeHtml(cityName(index))}" ${index===currentCity?"disabled":""}><i class="dot-core"></i>${withLabel?`<span>${escapeHtml(cityName(index))}</span>`:""}</button>`;
}
function hiddenPlaceName(key){
  const place=hiddenPlaces[key];
  if(!place) return key;
  return lang==="en" ? (place.titleEn||place.title||key) : (place.title||place.titleEn||key);
}
function hiddenPlaceRouteHint(key){
  if(key==="witch") return tr("Знайти знову: подорожуй між Києвом і Лісабоном.", "Find again: travel between Kyiv and Lisbon.");
  if(key==="smiths") return tr("Знайти знову: подорожуй між Краковом і Полоцьком.", "Find again: travel between Krakow and Polotsk.");
  if(key==="circus") return tr("Бродячий цирк може з'явитись на будь-якому маршруті з шансом 3%.", "The wandering circus can appear on any route with a 3% chance.");
  if(key==="scholars") return tr("Караван науковців може з'явитись на будь-якому маршруті з шансом 3%.", "The scholars' caravan can appear on any route with a 3% chance.");
  return tr("Це приховане місце вже знайдено, але їхати до нього напряму не можна.", "This hidden place is discovered, but it cannot be targeted directly.");
}
function plainMapHint(text){
  return String(text||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim();
}
function hiddenPlaceMapMarkers(){
  if(!player || !Array.isArray(player.foundHiddenPlaces)) return "";
  return player.foundHiddenPlaces
    .filter(key=>hiddenPlaces[key] && hiddenMapPoints[key])
    .map(key=>{
      const point=hiddenMapPoint(key);
      const place=hiddenPlaces[key];
      const desc=lang==="en" ? (place.descEn||place.desc||"") : (place.desc||place.descEn||"");
      const hint=`${hiddenPlaceName(key)}. ${hiddenPlaceRouteHint(key)} ${plainMapHint(desc).slice(0,180)}`;
      return `<div class="map-hidden-marker" style="left:${point.x}%;top:${point.y}%" title="${escapeHtml(hint)}" data-hint="${escapeHtml(hint)}" aria-label="${escapeHtml(hint)}"><i>${point.icon}</i><span>${escapeHtml(hiddenPlaceName(key))}</span></div>`;
    }).join("");
}
function travelRouteSvg(origin,destination,animated=true){
  const from=cityMapPoint(origin);
  const to=cityMapPoint(destination);
  const cls=animated?"travel-route-line":"travel-route-line travel-route-static";
  return `<svg class="travel-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="travel-route-shadow" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line><line class="${cls}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line></svg>`;
}
function travelHeroMarkerHtml(origin,destination,progress=null){
  const from=cityMapPoint(origin);
  const to=cityMapPoint(destination);
  if(progress===null){
    return `<div class="map-hero-marker" style="--from-x:${from.x}%;--from-y:${from.y}%;--to-x:${to.x}%;--to-y:${to.y}%">🧭</div>`;
  }
  const x=from.x+(to.x-from.x)*progress;
  const y=from.y+(to.y-from.y)*progress;
  return `<div class="map-hero-marker map-hero-marker-step" style="left:${x}%;top:${y}%">🧭</div>`;
}
// v0.43: build the map once per journey; update only the marker position smoothly
function renderTravelAnimMap(origin,destination,progress=0){
  const target=document.getElementById("travelAnimMap");
  if(!target) return;
  const route=travelRouteSvg(origin,destination,true);
  const endpoints=`<button class="map-city-dot current anim-city-dot" style="left:${cityMapPoint(origin).x}%;top:${cityMapPoint(origin).y}%"><i class="dot-core"></i><span>${escapeHtml(cityName(origin))}</span></button><button class="map-city-dot selected anim-city-dot" style="left:${cityMapPoint(destination).x}%;top:${cityMapPoint(destination).y}%"><i class="dot-core"></i><span>${escapeHtml(cityName(destination))}</span></button>`;
  const from=cityMapPoint(origin),to=cityMapPoint(destination);
  const x=from.x+(to.x-from.x)*progress, y=from.y+(to.y-from.y)*progress;
  target.innerHTML=`<div class="travel-map travel-map-compact">${html5TravelMapBackdrop()}${route}<div id="travelAnimHero" class="map-hero-marker travel-anim-hero" style="left:${x}%;top:${y}%">🐎</div>${endpoints}</div>`;
}
let _travelAnimRAF=null;
let _travelAnimProgressFrom=0;
function smoothTravelProgress(targetProgress,durationMs){
  if(!_travelAnimRoute) return;
  if(_travelAnimRAF) cancelAnimationFrame(_travelAnimRAF);
  const startProgress=_travelAnimProgressFrom;
  const startTime=performance.now();
  const from=cityMapPoint(_travelAnimRoute.origin);
  const to=cityMapPoint(_travelAnimRoute.destination);
  const hero=document.getElementById("travelAnimHero");
  const fill=document.getElementById("travelAnimProgressFill");
  const wagon=document.getElementById("travelAnimWagon");
  function step(t){
    const elapsed=t-startTime;
    const k=Math.min(1,elapsed/durationMs);
    // easeInOutCubic for natural motion
    const eased=k<0.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    const p=startProgress+(targetProgress-startProgress)*eased;
    if(hero){
      const x=from.x+(to.x-from.x)*p, y=from.y+(to.y-from.y)*p;
      hero.style.left=x+"%";
      hero.style.top=y+"%";
      // subtle bounce while moving
      const moving=Math.abs(targetProgress-startProgress)>0.01;
      hero.style.transform=moving?`translate(-50%,-50%) translateY(${Math.sin(k*Math.PI*6)*-2}px)`:`translate(-50%,-50%)`;
    }
    if(fill) fill.style.width=Math.round(p*100)+"%";
    if(wagon) wagon.style.left=`calc(${p*100}% - 11px)`;
    if(k<1) _travelAnimRAF=requestAnimationFrame(step);
    else {_travelAnimRAF=null;_travelAnimProgressFrom=targetProgress;}
  }
  _travelAnimRAF=requestAnimationFrame(step);
}
function renderTravelMap(){
  const target=document.getElementById("travelMap");
  if(!target) return;
  const destination=Number.isInteger(selectedTravelDestination) && selectedTravelDestination!==currentCity
    ? selectedTravelDestination
    : null;
  const from=cityMapPoint(currentCity);
  const to=destination!=null?cityMapPoint(destination):from;
  const route=destination!=null
    ? travelRouteSvg(currentCity,destination,true)+travelHeroMarkerHtml(currentCity,destination,null)
    : travelHeroMarkerHtml(currentCity,currentCity,null);
  const dots=cities.map((city,index)=>travelMapMarkerHtml(index,true)).join("");
  const hidden=hiddenPlaceMapMarkers();
  const caption=destination!=null
    ? `${escapeHtml(cityName(currentCity))} → ${escapeHtml(cityName(destination))} • ${routeAdjustedDays(currentCity,destination)} ${tr("дн.","d")}`
    : `${tr("Поточне місто","Current city")}: ${escapeHtml(cityName(currentCity))}`;
  target.innerHTML=`<div class="travel-map">${html5TravelMapBackdrop()}${route}${dots}${hidden}<div class="travel-map-caption"><span>${caption}</span><span>${tr("Натисни місто на карті, щоб прокласти шлях","Tap a city on the map to plot a route")}</span></div></div>`;
}

function npcCard(n,mode){
  const isSlave=n.status==="slave";
  const tenure=mode==="owned"?`<span class="badge">${tr("Разом","Together")}: ${n.daysTogether} ${tr("дн.","d.")}</span>`:"";
  const career=mode==="owned"?careerHint(n):"";
  const portraits=portraitPaths(n);
  const portrait=portraits.shift();
  const relationship=mode==="owned"?`<span class="badge relation-rank">${tr("Стосунки","Relations")} ${relationshipRank(n)}: ${relationshipLabel(n)}</span>`:"";
  const gender=`<span class="badge gender-sign">${n.gender==="female"?tr("♀ Жінка","♀ Woman"):tr("♂ Чоловік","♂ Man")}</span>`;
  const longevity=n.longLived?`<span class="badge relation-rank">${tr("Довгожитель","Long-lived")}</span>`:"";
  const location=mode==="owned"?`<span class="badge">${tr("Перебуває","Located")}: ${cityName(n.locationCity)}</span>`:"";
  return `<div class="card npc-card gender-${n.gender}"><div class="portrait">${portraitHtml(n)}</div><div><div class="card-title"><b>${htmlName(n)}</b><span class="badge">${statusLabel(n)} • ${escapeHtml(n.profession)}</span></div>${gender}<span class="badge">${tr("Вік","Age")}: ${n.age}</span>${longevity}<span class="badge">${tr("Звідки","From")}: ${escapeHtml(cityNameByName(n.homeCity)||n.homeCity)}</span>${location}${tenure}${relationship}<span class="badge">${compensationText(n)}</span><br><span class="badge">${tr("Сила","Str")} ${n.strength}</span><span class="badge">${tr("Ремесло","Crf")} ${n.craft}</span><span class="badge">${tr("Бій","Cmb")} ${n.combat}</span><span class="badge">${tr("Гостинність","Svc")} ${n.service}</span><span class="badge">${tr("Лояльність","Loy")} ${n.loyalty}</span><span class="badge">${tr("Покірність","Obd")} ${n.obedience}</span><span class="badge">${tr("Здоров'я","Hp")} ${n.health}</span><div class="person-profile"><strong>${escapeHtml(n.trait.name)}</strong> (${escapeHtml(n.trait.effect)})<br>${escapeHtml(n.trait.description)}<br><span class="muted">${escapeHtml(n.story)} ${escapeHtml(displayFirstName(n))} ${escapeHtml(n.hope)}.</span></div><p class="muted">${tr("Робота","Job")}: <b>${escapeHtml(n.job)}</b></p>${career}<p>${tr("Ціна / цінність","Price / value")}: <b>${mode==="market"?npcPrice(n):(n.value||n.price)}</b></p></div><div class="actions">${mode==="market"?`<button class="btn green" onclick="buyNPC(${n.id})">${isSlave?tr("Купити","Buy"):tr("Найняти","Hire")}</button>`:managerActions(n)}</div></div>`;
}
function careerHint(person){
  if(person.status==="slave") return `<p class="career-note">${tr("Кріпак: разом 5 днів, покірність 6, сила або ремесло 8.","Serf: 5 days together, obedience 6, strength or craft 8.")}</p>`;
  if(person.status==="serf") return `<p class="career-note">${tr("Громадянин: разом 10 днів, лояльність 9, робоча навичка 8.","Citizen: 10 days together, loyalty 9, work skill 8.")}</p>`;
  if(!person.mastery) return `<p class="career-note">${tr("Майстер: 12 днів, робоча навичка 12 і призначення в справу.","Master: 12 days, work skill 12, assigned to a craft.")}</p>`;
  return `<p class="career-note">Визнаний майстер справи: ${person.mastery}.</p>`;
}
function managerActions(n,includeProfile=true){
  const profileLbl=tr("Особова справа","Profile");
  const relLbl=tr("Стосунки","Relations");
  const giftLbl=tr("Подарунок","Gift");
  if(n.status==="child") return `${includeProfile?`<button class="btn blue" onclick="openNpcProfile(${n.id},'subordinates')">${profileLbl}</button>`:""}`;
  const workBtns=`<button class="btn" onclick="assignNPC(${n.id},'${n.status}','Склад')">${tr("На склад","To warehouse")}</button><button class="btn" onclick="assignNPC(${n.id},'${n.status}','Тренування')">${tr("На тренування","To training")}</button><button class="btn" onclick="assignNPC(${n.id},'${n.status}','Ткацький цех')">${tr("У ткацький цех","To weaving")}</button><button class="btn" onclick="assignNPC(${n.id},'${n.status}','Кузня')">${tr("У кузню","To smithy")}</button><button class="btn" onclick="assignNPC(${n.id},'${n.status}','Ювелірна майстерня')">${tr("До ювеліра","To jeweller")}</button><button class="btn" onclick="assignNPC(${n.id},'${n.status}','Меблева майстерня')">${tr("До столяра","To joiner")}</button><button class="btn" onclick="assignNPC(${n.id},'${n.status}','Ферма')">${tr("На ферму","To farm")}</button><button class="btn" onclick="assignNPC(${n.id},'${n.status}','Кухня')">${tr("На кухню","To kitchen")}</button>${n.status!=="slave"?`<button class="btn" onclick="assignNPC(${n.id},'${n.status}','Заїжджий двір')">${tr("У заїжджий двір","To inn")}</button>`:""}`;
  const work=`<details class="npc-actions-toggle" open><summary>📋 ${tr("Призначити на роботу","Assign to work")}</summary><div class="toggle-body">${workBtns}</div></details>`;
  const relationButton=`<button class="btn blue" onclick="openRelationshipDialog(${n.id})">${relLbl}</button>`;
  const common=`${includeProfile?`<button class="btn blue" onclick="openNpcProfile(${n.id},'subordinates')">${profileLbl}</button>${relationButton}`:`<button class="btn blue" onclick="rewardNPC(${n.id},'${n.status}')">${giftLbl}</button>${relationButton}`}`;
  if(n.status==="slave"){
    const slaveAdv=`<button class="btn gray" onclick="assignNPC(${n.id},'${n.status}','Камера')">${tr("У камеру","To cell")}</button><button class="btn green" onclick="promoteSerf(${n.id})">${tr("Зробити кріпаком","Make a serf")}</button><button class="btn green" onclick="emancipateSlave(${n.id},false)">${tr("Звільнити у громадяни","Free as citizen")}</button><button class="btn green" onclick="releaseSlave(${n.id})">${tr("Відпустити на волю","Release to freedom")}</button><button class="btn blue" onclick="emancipateSlave(${n.id},true)">${tr("Публічно звільнити","Publicly free")}</button><button class="btn red" onclick="executeNPC(${n.id})">${tr("Стратити","Execute")}</button><button class="btn red" onclick="publicExecuteNPC(${n.id})">${tr("Публічно стратити","Public execution")}</button>`;
    return common+work+`<details class="npc-actions-toggle" open><summary>⚖️ ${tr("Статус і покарання","Status & punishment")}</summary><div class="toggle-body">${slaveAdv}</div></details>`;
  }
  const advBtns=(n.status==="serf"?`<button class="btn green" onclick="grantCitizenship(${n.id})">${tr("Надати громадянство","Grant citizenship")}</button>`:"")+(!n.mastery?`<button class="btn green" onclick="certifyMaster(${n.id},'${n.status}')">${tr("Визнати майстром","Certify master")}</button>`:"")+`<button class="btn gray" onclick="dismissNPC(${n.id},'${n.status}')">${tr("Відпустити","Dismiss")}</button>`;
  const adv=advBtns?`<details class="npc-actions-toggle" open><summary>⚖️ ${tr("Статус","Status")}</summary><div class="toggle-body">${advBtns}</div></details>`:"";
  return common+work+adv;
}
function renderNpcMarket(){
  const localPeople=npcMarket.filter(person=>person.city===currentCity);
  const noneLbl=tr("Немає кандидатів","No candidates");
  const menLbl=tr("♂ Чоловіки","♂ Men"),womenLbl=tr("♀ Жінки","♀ Women");
  const lane=(status,gender,title)=>{
    const cards=localPeople.filter(n=>n.status===status&&n.gender===gender).map(n=>npcCard(n,"market")).join("")||`<div class="empty">${noneLbl}</div>`;
    return `<div class="people-lane"><h3>${title}</h3><div class="people-lane-scroll">${cards}</div></div>`;
  };
  // v0.43: render Free and Slave markets into separate Square sub-containers
  const free=localPeople.filter(p=>p.status==="free");
  const slaves=localPeople.filter(p=>p.status==="slave");
  const freeEl=document.getElementById("npcMarketFree");
  const slavesEl=document.getElementById("npcMarketSlaves");
  if(freeEl){
    const hint=document.getElementById("peopleMarketHint");
    if(hint) hint.innerText=tr("Місто: ","City: ")+cityName(currentCity)+tr(". Доступно вільних: ",". Free candidates available: ")+free.length+".";
    if(!free.length){
      freeEl.innerHTML=`<div class="empty">${tr("Сьогодні в місті немає вільних кандидатів.","No free candidates available in town today.")}</div>`;
    }else{
      freeEl.innerHTML=`<div class="people-columns single"><div>${lane("free","male",menLbl)}${lane("free","female",womenLbl)}</div></div>`;
    }
  }
  if(slavesEl){
    const hintS=document.getElementById("slavesMarketHint");
    if(hintS) hintS.innerText=tr("Місто: ","City: ")+cityName(currentCity)+tr(". Доступно рабів: ",". Bonded available: ")+slaves.length+".";
    if(!slaves.length){
      slavesEl.innerHTML=`<div class="empty">${tr("Сьогодні в місті немає підневільних кандидатів.","No bonded people available today.")}</div>`;
    }else{
      slavesEl.innerHTML=`<div class="people-columns single"><div>${lane("slave","male",menLbl)}${lane("slave","female",womenLbl)}</div></div>`;
    }
  }
  // Legacy container retained for backward compat
  const legacy=document.getElementById("npcMarket");
  if(legacy && !freeEl && !slavesEl){
    if(!localPeople.length){
      legacy.innerHTML=`<div class="empty">${tr("Сьогодні в місті немає доступних кандидатів.","No candidates available in town today.")}</div>`;
    }else{
      legacy.innerHTML=`<div class="people-columns"><div><h2 class="subhead">${tr("Найманці","Hirelings")}</h2>${lane("free","male",menLbl)}${lane("free","female",womenLbl)}</div><div><h2 class="subhead">${tr("Підневільні люди","Bonded people")}</h2>${lane("slave","male",menLbl)}${lane("slave","female",womenLbl)}</div></div>`;
    }
  }
}

// === v0.43: Square (Main Square) — city hub combining Guild, Shop, Employment, Slave Market ===
let currentSquareSub="guild";
function setSquareSub(name){
  if(!["guild","townhall","tavern","shop","people","slaves"].includes(name)) return;
  currentSquareSub=name;
  document.querySelectorAll(".square-tab").forEach(b=>b.classList.toggle("active",b.dataset.sub===name));
  document.querySelectorAll(".square-sub").forEach(div=>div.classList.toggle("active",div.id==="sub-"+name));
  // Re-render the relevant sub
  if(name==="guild") renderGuild();
  else if(name==="townhall") renderTownHall();
  else if(name==="tavern") renderTavern();
  else if(name==="shop") renderShops();
  else if(name==="people"||name==="slaves") renderNpcMarket();
}
function renderSquare(){
  // Top banner: city image + facts (mirrors Market tab info)
  const city=cities[currentCity];
  const profile=cityProfiles[currentCity];
  const banner=document.getElementById("squareCity");
  if(banner){
    const factLabels=lang==="en"?["Founded","Population","Religion","Authority"]:["Заснування","Населення","Релігія","Влада"];
    banner.innerHTML=`
      <div class="square-banner">
        <div class="square-banner-art"><img src="assets/cities/${cityArtKeys[currentCity]}.png" onerror="this.style.display='none'"></div>
        <div class="square-banner-info">
          <h3>📍 ${escapeHtml(cityName(currentCity))}, ${escapeHtml(regionName(city.region))}</h3>
          <p><b>${factLabels[0]}:</b> ${escapeHtml(profile[0])} • <b>${factLabels[1]}:</b> ${escapeHtml(profile[1])}</p>
          <p><b>${factLabels[2]}:</b> ${escapeHtml(profile[2])} • <b>${factLabels[3]}:</b> ${escapeHtml(profile[3])}</p>
          <p class="muted">${escapeHtml(reputationLabel(currentCity))}</p>
        </div>
      </div>`;
  }
  // Render sub-content; ensure currentSquareSub matches DOM state
  setSquareSub(currentSquareSub);
}
function renderOwned(){
  document.getElementById("ownedSlaves").innerHTML=ownedSlaves.length?ownedSlaves.map(n=>npcCard(n,"owned")).join(""):`<div class="empty">${tr("У тебе немає куплених рабів.","You have no bonded people.")}</div>`;
  document.getElementById("ownedHirelings").innerHTML=ownedHirelings.length?ownedHirelings.map(n=>npcCard(n,"owned")).join(""):`<div class="empty">${tr("У тебе немає найманців.","You have no hirelings.")}</div>`;
}
function itemCard(item){
  const quality=itemRarity(item).colorClass;
  const buyLbl=tr("Купити","Buy"),priceLbl=tr("Ціна","Price"),haveLbl=tr("Маєш","Have"),availLbl=tr("Залишок","In stock");
  const stockLeft=shopStockCount(item.id,"npc");
  const stockBadge=`<span class="badge ${stockLeft<=1?"trend-down":""}">${availLbl}: ${stockLeft}</span>`;
  const buyDisabled=stockLeft<=0?"disabled":"";
  return `<div class="card shop-item quality-frame-${quality}"><div class="item-icon"><img src="${item.img}" onerror="this.remove();this.parentElement.innerHTML='${item.icon}'"></div><div><div class="card-title"><b class="quality-name-${quality}">${item.name}</b><span class="badge">${giftSlots[item.slot]}</span></div>${rarityBadge(item)}<p class="muted">${item.desc}</p><span class="badge">${itemEffectText(item)}</span><span class="badge">${priceLbl}: ${shopPrice(item.price)}</span>${stockBadge}<span class="badge">${haveLbl}: ${itemStock(item.id)}</span><div class="trade-actions"><button class="btn green" ${buyDisabled} onclick="buyGiftItem('${item.id}')">${buyLbl}</button></div></div></div>`;
}
function homeItemCard(item){
  const quality=itemRarity(item).colorClass;
  const locations=item.rooms.map(key=>roomByKey(key).name).join(", ");
  const buyLbl=tr("Купити","Buy"),priceLbl=tr("Ціна","Price"),haveLbl=tr("Маєш","Have"),forLbl=tr("Для","For"),availLbl=tr("Залишок","In stock");
  const stockLeft=shopStockCount(item.id,"home");
  const stockBadge=`<span class="badge ${stockLeft<=1?"trend-down":""}">${availLbl}: ${stockLeft}</span>`;
  const buyDisabled=stockLeft<=0?"disabled":"";
  return `<div class="card shop-item quality-frame-${quality}"><div class="item-icon"><img src="${item.img}" onerror="this.remove();this.parentElement.innerHTML='${item.icon}'"></div><div><div class="card-title"><b class="quality-name-${quality}">${item.name}</b>${rarityBadge(item)}</div><p class="muted">${item.desc}</p><span class="badge">${homeEffectText(item)}</span><span class="badge">${forLbl}: ${locations}</span><span class="badge">${priceLbl}: ${shopPrice(item.price)}</span>${stockBadge}<span class="badge">${haveLbl}: ${homeStock(item.id)}</span><div class="trade-actions"><button class="btn green" ${buyDisabled} onclick="buyHomeItem('${item.id}')">${buyLbl}</button></div></div></div>`;
}
function currentShopWeek(){return Math.floor((day-1)/BALANCE.shopStockDays);}
function daysUntilShopRefresh(){return BALANCE.shopStockDays-((day-1)%BALANCE.shopStockDays);}
function sampleCatalog(items,count,previousIds){
  const blocked=new Set(previousIds||[]);
  const pool=items.length>count?items.filter(item=>!blocked.has(item.id)):items.slice();
  const source=pool.length>=count?pool:items.slice();
  const selected=[];
  const copy=source.slice();
  while(copy.length && selected.length<count){
    selected.push(copy.splice(rand(0,copy.length-1),1)[0].id);
  }
  return selected;
}
function shopNpcCandidates(){
  const tier=cities[currentCity].shopTier;
  return itemCatalog.filter(item=>!item.loot && item.store!=="combat" && rarityRanks[item.rarity||"common"]<=tier);
}
function shopHomeCandidates(){
  const tier=cities[currentCity].shopTier;
  return homeItemCatalog.filter(item=>!item.loot && ((item.rarity==="common") || (item.rarity==="rare" && tier>=3)));
}
// v0.43: per-item quantity limits in shop. Each item gets 1-3 stock based on rarity.
function shopStockSizeFor(rarity){
  // Higher rarity → fewer copies
  if(rarity==="legendary") return 1;
  if(rarity==="epic") return 1;
  if(rarity==="rare") return rand(1,2);
  if(rarity==="improved") return rand(1,3);
  return rand(2,3); // common
}
function ensureShopStock(){
  const week=currentShopWeek();
  if(!shopStock || !shopStock.cities) shopStock={cities:{}};
  const current=shopStock.cities[currentCity];
  if(current && current.week===week) return;
  const previousNpc=current?current.npcIds||(current.npcStock?Object.keys(current.npcStock):[]):[];
  const previousHome=current?current.homeIds||(current.homeStock?Object.keys(current.homeStock):[]):[];
  const npcIds=sampleCatalog(shopNpcCandidates(),BALANCE.shopStockSize,previousNpc);
  const homeIds=sampleCatalog(shopHomeCandidates(),BALANCE.shopStockSize,previousHome);
  const npcStock={},homeStock={};
  npcIds.forEach(id=>{const it=itemById(id);if(it) npcStock[id]=shopStockSizeFor(it.rarity||"common");});
  homeIds.forEach(id=>{const it=homeItemById(id);if(it) homeStock[id]=shopStockSizeFor(it.rarity||"common");});
  shopStock.cities[currentCity]={week,npcIds,homeIds,npcStock,homeStock};
}
// v0.43: stock accessors and decrement
function shopStockCount(id,kind){
  ensureShopStock();
  const data=shopStock.cities[currentCity];
  if(!data) return 0;
  const store=kind==="home"?(data.homeStock||{}):(data.npcStock||{});
  return Math.max(0,store[id]||0);
}
function decrementShopStock(id,kind){
  ensureShopStock();
  const data=shopStock.cities[currentCity];
  if(!data) return false;
  const key=kind==="home"?"homeStock":"npcStock";
  if(!data[key]) data[key]={};
  if(!data[key][id] || data[key][id]<=0) return false;
  data[key][id]-=1;
  return true;
}
function localShopItems(store){
  ensureShopStock();
  return (shopStock.cities[currentCity].npcIds||[]).map(itemById).filter(item=>item&&item.store===store&&shopStockCount(item.id,"npc")>0);
}
function localHomeItems(){
  ensureShopStock();
  return (shopStock.cities[currentCity].homeIds||[]).map(homeItemById).filter(item=>item&&shopStockCount(item.id,"home")>0);
}
function renderShops(){
  const worker=document.getElementById("workerShop");
  if(!worker) return;
  document.getElementById("localShopName").innerText=tr("Крамниця міста ","Shop of ")+cityName(currentCity);
  const rarityName=itemRarities[Object.keys(rarityRanks).find(key=>rarityRanks[key]===cities[currentCity].shopTier)].name;
  document.getElementById("localShopHint").innerText=tr(
    `Асортимент міста: доступні речі до якості «${rarityName}». На тиждень виставлено до 5 речей для NPC і до 5 речей для дому. Оновлення через ${daysUntilShopRefresh()} дн.`,
    `City stock: items up to «${rarityName}» quality. Up to 5 NPC items and 5 home items per week. Refresh in ${daysUntilShopRefresh()} d.`
  );
  const pcsLbl=tr("шт.","pcs");
  worker.innerHTML=localShopItems("worker").map(itemCard).join("")||`<div class="empty">${tr("Цього тижня немає одягу, прикрас або талісманів для найманців.","No clothing, jewelry or talismans for hirelings this week.")}</div>`;
  document.getElementById("supportShop").innerHTML=localShopItems("support").map(itemCard).join("")||`<div class="empty">${tr("Цього тижня немає спеціального забезпечення для підневільних людей.","No special supplies for bonded people this week.")}</div>`;
  document.getElementById("homeShop").innerHTML=localHomeItems().map(homeItemCard).join("")||`<div class="empty">${tr("Цього тижня майстри не виставили меблів для штабу.","No HQ furniture from craftsmen this week.")}</div>`;
  const stocked=itemCatalog.filter(item=>itemStock(item.id)>0);
  document.getElementById("giftInventory").innerHTML=stocked.length?stocked.map(item=>`<div class="stock-line"><span>${item.icon} <b class="quality-name-${itemRarity(item).colorClass}">${item.name}</b> ${rarityBadge(item)} <span class="badge">${giftSlots[item.slot]}</span>${item.lore?`<span class="item-lore">${item.lore}</span>`:""}</span><b>${itemStock(item.id)} ${pcsLbl}</b></div>`).join(""):`<div class="empty">${tr("Придбаних речей поки немає. Легендарні речі іноді трапляються під час особистих подорожей.","No items owned yet. Legendary items may turn up during travels.")}</div>`;
  const homeStocked=homeItemCatalog.filter(item=>homeStock(item.id)>0);
  document.getElementById("homeInventory").innerHTML=homeStocked.length?homeStocked.map(item=>`<div class="stock-line"><span>${item.icon} <b class="quality-name-${itemRarity(item).colorClass}">${item.name}</b> ${rarityBadge(item)} <span class="badge">${homeEffectText(item)}</span>${item.lore?`<span class="item-lore">${item.lore}</span>`:""}</span><b>${homeStock(item.id)} ${pcsLbl}</b></div>`).join(""):`<div class="empty">${tr("Меблів у запасі немає.","No furniture in stock.")}</div>`;
}
function rewardPreview(reward){
  if(!reward) return "";
  if(reward.type==="goods"){
    const keys={"Зерно":"grain","Віск":"wax","Льон":"linen","Сіль":"salt"};
    return `<div class="reward-preview"><div class="reward-image"><img src="assets/goods/${keys[reward.name]||"goods"}.png" onerror="this.remove();this.parentElement.innerHTML='📦'"></div><div><b>${reward.qty} × ${escapeHtml(goodName(reward.name))}</b><br><span class="muted">${tr("Товарна нагорода мерії","Council goods reward")}</span></div></div>`;
  }
  const item=reward.type==="homeItem"?homeItemById(reward.id):itemById(reward.id);
  const effect=reward.type==="homeItem"?homeEffectText(item):itemEffectText(item);
  return `<div class="reward-preview"><div class="reward-image"><img src="${item.img}" onerror="this.remove();this.parentElement.innerHTML='${item.icon}'"></div><div><b class="quality-name-${itemRarity(item).colorClass}">${item.name}</b> ${rarityBadge(item)}<br><span class="muted">${effect}</span></div></div>`;
}
function questCard(quest,available){
  const totalDays=travelDaysBetween(quest.issuer,quest.source)+travelDaysBetween(quest.source,quest.destination);
  const dst=cityName(quest.destination),src=cityName(quest.source),iss=cityName(quest.issuer);
  const progress=quest.accepted?`<span class="badge">${tr("Закуплено","Bought")}: ${quest.acquired} / ${quest.qty}</span><span class="badge">${tr("Доставлено","Delivered")}: ${quest.delivered} / ${quest.qty}</span><span class="badge">${tr("До дня","By day")}: ${quest.deadline}</span>`:"";
  const finish=quest.kind==="guild"?tr(`Продайте товар на ринку міста ${dst}.`,`Sell the goods at the market of ${dst}.`):tr(`Передайте товар мерії міста ${dst}.`,`Hand the goods to the city council of ${dst}.`);
  const handover=quest.accepted && quest.kind==="council" && quest.destination===currentCity?`<button class="btn blue" onclick="deliverCouncilQuest(${quest.id})">${tr("Передати мерії","Hand to council")}</button>`:"";
  const repReward=quest.kind==="guild"?1:2;
  const reward=quest.kind==="guild"
    ? `<p class="muted">${tr("Винагорода гільдії","Guild reward")}: <b>+${quest.payment}</b> ${tr("монет","coins")}. ${tr("Репутація міста","City reputation")}: <b>+${repReward}</b>.</p>`
    : rewardPreview(quest.reward)+`<p class="muted">${tr("Додатково","Bonus")}: <b>${tr("склад","warehouse")} +1</b>, ${tr("репутація міста","city reputation")} <b>+${repReward}</b>.</p>`;
  const acceptActions=quest.kind==="guild"
    ? `<button class="btn green" onclick="acceptQuest(${quest.id})">${tr("Прийняти","Accept")}</button><button class="btn blue" onclick="acceptQuest(${quest.id},true)">${tr("Прийняти з охороною (-20% винагороди)","Accept with escort (-20% reward)")}</button>`
    : `<button class="btn green" onclick="acceptQuest(${quest.id})">${tr("Прийняти замовлення","Accept order")}</button>`;
  const buyLine=tr(`<b>1.</b> Придбайте ${quest.qty} × ${escapeHtml(goodName(quest.good))} у місті <b>${src}</b>.`,`<b>1.</b> Buy ${quest.qty} × ${escapeHtml(goodName(quest.good))} in <b>${src}</b>.`);
  return `<div class="card guild-contract"><div class="card-title"><b>${escapeHtml(quest.title)}</b><span class="badge">${tr("Складність","Difficulty")} ${quest.difficulty||1}</span></div><p>${escapeHtml(quest.reason)}</p><div class="contract-route">${buyLine}<br><b>2.</b> ${finish}</div><span class="badge">${tr("Маршрут","Route")}: ${iss} → ${src} → ${dst}</span><span class="badge">${tr("Час дороги","Travel time")}: ~${totalDays} ${tr("дн.","d.")}</span><span class="badge">${tr("Капітал","Capital")}: ~${quest.investment}</span>${quest.guarded?`<span class="badge">🛡️ ${tr("Найнята охорона","Hired escort")}</span>`:""}${progress}${reward}${available?`<div class="trade-actions">${acceptActions}</div>`:handover?`<div class="trade-actions">${handover}</div>`:""}</div>`;
}
function renderGuild(){
  const board=document.getElementById("guildBoard");
  if(!board) return;
  document.getElementById("guildName").innerText=tr("Гільдія торговців міста ","Merchants' guild of ")+cityName(currentCity);
  document.getElementById("guildRegion").innerText=regionName(cities[currentCity].region)+tr(". Рівень героя: ",". Hero level: ")+playerLevel()+" ("+rankName(rankInfo())+"). "+tr("Гільдія видає доречні рівню контракти, винагороджує лише монетами; ліміт - два активні.","The guild offers level-appropriate contracts and rewards only in coins; limit — two active.");
  if(isCityLocked(currentCity)){
    board.innerHTML=cityLockBanner();
    document.getElementById("activeGuildQuests").innerHTML="";
    return;
  }
  board.innerHTML=guildBoards[currentCity].filter(quest=>!quest.accepted).map(quest=>questCard(quest,true)).join("") || `<div class="empty">${tr("Нові контракти готуються писарями.","Scribes are preparing new contracts.")}</div>`;
  const active=activeQuests().filter(q=>q.kind==="guild");
  document.getElementById("activeGuildQuests").innerHTML=active.length?active.map(quest=>questCard(quest,false)).join(""):`<div class="empty">${tr("Прийнятих замовлень поки немає.","No accepted orders yet.")}</div>`;
}
function renderTownHall(){
  const board=document.getElementById("councilBoard");
  if(!board) return;
  document.getElementById("councilName").innerText=tr("🏛️ Мерія міста ","🏛️ City council of ")+cityName(currentCity);
  document.getElementById("councilRegion").innerText=tr("Міська рада замовляє доставку для комор, ремонту, варти або подій і винагороджує товарами чи предметами. Ліміт - одне активне доручення.","The city council orders deliveries for granaries, repairs, the guard or events, and rewards with goods or items. Limit — one active order.");
  if(isCityLocked(currentCity)){
    board.innerHTML=cityLockBanner();
    document.getElementById("activeCouncilQuests").innerHTML="";
    return;
  }
  board.innerHTML=councilBoards[currentCity].filter(quest=>!quest.accepted).map(quest=>questCard(quest,true)).join("") || `<div class="empty">${tr("Рада нічого не замовляє цього тижня.","The council has no orders this week.")}</div>`;
  const active=activeQuests().filter(q=>q.kind==="council");
  document.getElementById("activeCouncilQuests").innerHTML=active.length?active.map(quest=>questCard(quest,false)).join(""):`<div class="empty">${tr("Прийнятих доручень мерії поки немає.","No accepted council orders yet.")}</div>`;
}
// === v0.44: City lock system ===
function isCityLocked(city){return Boolean(player&&player.cityLocks&&player.cityLocks[city]);}
function lockCity(city,reason){
  if(!player) return;
  player.cityLocks=player.cityLocks||{};
  if(player.cityLocks[city]) return;
  player.cityLocks[city]={reason:reason||"fraud",day};
  // crash reputation
  player.cityReputation=player.cityReputation||{};
  player.cityReputation[city]=-20;
  logAction("🚫 "+tr("Місто ","The city of ")+cityName(city)+tr(" закрило перед тобою всі двері: міська варта оголосила тебе шахраєм у таверні. Репутація впала до -20."," has shut every door before you: the city watch declared you a tavern cheat. Reputation crashed to -20."),"travel");
}
function unlockCity(city){
  if(!player||!player.cityLocks) return;
  delete player.cityLocks[city];
  logAction("✅ "+tr("Шахрайський борг у місті ","The fraud debt in ")+cityName(city)+tr(" сплачено. Двері знову відчинені."," has been paid. Doors are open again."),"travel");
}
function cityLockBanner(){
  return `<div class="empty city-lock-banner">🚫 ${tr("Це місце для тебе зачинене. Сплати штраф у таверні.","This place is closed to you. Pay the fine in the tavern.")} <button class="btn red" onclick="openCityLockModal()">${tr("Подробиці","Details")}</button></div>`;
}
function openCityLockModal(){
  const c=currentCity;
  const lockText=tr(
    "Міська рада оголосила тебе персоною нон-ґрата. Чутки про твій програш у кості без монет розлетілися по всіх кварталах. Двері гільдії, мерії, навіть найзачуханішої таверни зачиняються перед тобою. Сторожа біля брами зиркає скоса — ще трохи, і виставлять за міські стіни. Поки штраф не сплачено, у "+cityName(c)+" тобі немає життя.",
    "The city council has branded you persona non grata. Word of your unpaid dice debt has spread to every quarter. The doors of the guild, the town hall, even the meanest tavern shut before you. The watchmen at the gate eye you sideways — one more slip and you'll be put outside the walls. Until the fine is paid, there is no life for you in "+cityName(c)+"."
  );
  document.getElementById("cityLockText").innerText=lockText;
  document.getElementById("cityLockBlocks").innerHTML="🔒 "+tr("Заблоковано","Blocked")+": "+tr("гільдія, мерія, таверна, найм, ринок рабів","guild, town hall, tavern, hiring, slave market");
  document.getElementById("cityLockPayBtn").disabled=gold<1000;
  document.getElementById("cityLockPayBtn").innerHTML=`💰 ${tr("Сплатити штраф","Pay fine")}: 1000 ${tr("монет","coins")} (${tr("у скрині","you have")}: ${gold})`;
  document.getElementById("cityLockModal").classList.remove("hidden");
}
function closeCityLock(){document.getElementById("cityLockModal").classList.add("hidden");}
function payCityFine(){
  if(gold<1000){alert(tr("Недостатньо монет.","Not enough coins."));return;}
  gold-=1000;
  unlockCity(currentCity);
  closeCityLock();
  saveGame(false);
  render();
}
// === v0.44: Tavern ===
function renderTavern(){
  const body=document.getElementById("tavernBody");
  if(!body) return;
  if(isCityLocked(currentCity)){
    body.innerHTML=cityLockBanner();
    return;
  }
  const dice=player&&player.tavernDice||{wins:0,losses:0,debt:0};
  const meals=(player&&player.tavernMealsToday)||0;
  const today=(player&&player.tavernMealDay)===day;
  const mealsCount=today?meals:0;
  const mealLbl=tr("🍖 Вечеря з пивом","🍖 Dinner with ale");
  const mealCta=tr("Замовити (20 монет)","Order (20 coins)");
  const mealDisabled=gold<20?"disabled":"";
  const mealCount=mealsCount?` <span class="muted">(${tr("сьогодні","today")}: ${mealsCount})</span>`:"";
  const rumourHtml=(()=>{
    const heard=player&&player.lastTavernRumour;
    if(!heard) return `<p class="muted tavern-no-rumour">${tr("Замов вечерю — за столом сусіди розговоряться.","Order dinner — your neighbours will start talking.")}</p>`;
    return `<div class="tavern-rumour"><div class="tavern-meal-art"><img src="assets/locations/tavern_meal.jpg" onerror="this.style.display='none'"></div><div class="tavern-rumour-text">${escapeHtml(heard)}</div></div>`;
  })();
  const debtLine=dice.debt>0?`<div class="tavern-debt">⚠️ ${tr("Шахрайський борг у місті","Fraud debt in")}: <b>${dice.debt}</b></div>`:"";
  const diceBtns=[10,50,100].map(s=>`<button class="btn ${gold<s?"red":"green"}" onclick="tavernDiceRoll(${s})">🎲 ${tr("Ставка","Stake")} ${s}${gold<s?" ⚠️":""}</button>`).join("");
  body.innerHTML=`
    <div class="tavern-grid">
      <div class="tavern-card">
        <h3>${mealLbl}${mealCount}</h3>
        <p class="muted">${tr("Гарячий куліш, скибка хліба, кухоль темного пива. Відновить всі дії на цей день і подарує плітку від місцевих.","A hot stew, a slice of bread, a tankard of dark ale. Restores all actions for the day and earns you a local rumour.")}</p>
        <button class="btn gold" ${mealDisabled} onclick="tavernMeal()">${mealCta}</button>
        ${rumourHtml}
      </div>
      <div class="tavern-card">
        <h3>🎲 ${tr("Кості на гроші","Dice for coin")}</h3>
        <p class="muted">${tr("Кидаєш проти корчмаря дві кості — у нього випадає 2–12, у тебе 2–12. Більше число виграє. Можна грати в борг, але якщо нічим заплатити — місто закриє перед тобою всі двері.","You roll two dice against the innkeeper — he rolls 2–12, you roll 2–12. The higher total wins. Playing on credit is allowed, but if you can't pay, the city slams every door.")}</p>
        <div class="tavern-dice-row">${diceBtns}</div>
        <p class="muted small">${tr("Перемог","Wins")}: ${dice.wins} · ${tr("Поразок","Losses")}: ${dice.losses}</p>
        ${debtLine}
      </div>
    </div>`;
}
function tavernMeal(){
  if(isCityLocked(currentCity)){openCityLockModal();return;}
  if(gold<20){log("❌ "+tr("Недостатньо монет на вечерю.","Not enough coins for dinner."));render();return;}
  gold-=20;
  energy=dailyActionLimit();
  player.tavernMealDay=day;
  player.tavernMealsToday=((player.tavernMealDay===day?player.tavernMealsToday:0)||0)+1;
  // Try to reveal a fresh rumour (100% if any unheard exists in this city)
  player.rumorsHeard=player.rumorsHeard||{};
  const found=player.foundHiddenPlaces||[];
  const cand=TAVERN_RUMORS.filter(r=>r.city===currentCity && found.includes(r.place) && !player.rumorsHeard[r.id]);
  let rumourText="";
  if(cand.length){
    const r=cand[0];
    player.rumorsHeard[r.id]=true;
    rumourText=lang==="en"?r.en:r.uk;
  }else{
    // Generic atmospheric line if no decoded place yet or all heard
    const fallback=[
      tr("🍻 За сусіднім столом купець бурчить про дороги: «Знову розбійники в Чорному лісі. Караван без охорони — здобич для вовків та людей».","🍻 At the next table a merchant grumbles about the roads: «Bandits in the Black Forest again. An unguarded caravan is prey for wolves and men alike.»"),
      tr("🍻 Стара жінка біля вогнища шепоче: «Кажуть, у глухих краях ще живуть прокляті майстри й науковці-чарівники. Хто знайде — той забагатіє чи згине».","🍻 An old woman by the fire whispers: «They say in the wild lands cursed masters and sorcerer-scholars still live. He who finds them grows rich — or perishes.»"),
      tr("🍻 П'яний солдат піднімає кухоль: «За мою службу! За мою рану! За моє пиво!» — і падає лобом у миску.","🍻 A drunk soldier lifts his tankard: «To my service! To my wound! To my ale!» — then plants his forehead in the bowl.")
    ];
    rumourText=pick(fallback);
  }
  player.lastTavernRumour=rumourText;
  logAction("🍖 "+tr("Вечеря в таверні ","Dinner at the tavern of ")+cityName(currentCity)+tr(": дії відновлено."," : actions restored.")+" "+rumourText,"travel");
  saveGame(false);
  render();
}
function tavernDiceRoll(stake){
  if(isCityLocked(currentCity)){openCityLockModal();return;}
  if(!Number.isFinite(stake)||stake<=0) return;
  player.tavernDice=player.tavernDice||{wins:0,losses:0,debt:0};
  const p1=rand(1,6),p2=rand(1,6),pl=p1+p2;
  const i1=rand(1,6),i2=rand(1,6),inn=i1+i2;
  const diceFace=n=>["⚀","⚁","⚂","⚃","⚄","⚅"][n-1]||"🎲";
  document.getElementById("diceDisplay").innerText=`${diceFace(p1)}${diceFace(p2)}  ${tr("ти","you")}: ${pl}   ⚔   ${tr("корчмар","innkeeper")}: ${inn}  ${diceFace(i1)}${diceFace(i2)}`;
  let result="";
  if(pl>inn){
    gold+=stake;
    player.tavernDice.wins++;
    result=`✅ ${tr("Перемога","Win")}! +${stake} ${tr("монет","coins")}.`;
    logAction("🎲 "+tr("Виграш у кості: +","Dice win: +")+stake+" "+tr("монет.","coins."),"travel");
    try{CG.happytime&&CG.happytime();}catch(e){}
  }else if(pl<inn){
    player.tavernDice.losses++;
    if(gold>=stake){
      gold-=stake;
      result=`❌ ${tr("Поразка","Loss")}. -${stake} ${tr("монет","coins")}.`;
      logAction("🎲 "+tr("Програш у кості: -","Dice loss: -")+stake+" "+tr("монет.","coins."),"travel");
    }else{
      const debt=stake-gold;
      gold=0;
      player.tavernDice.debt=(player.tavernDice.debt||0)+debt;
      result=`💀 ${tr("Поразка без монет!","Loss with no coin!")} ${tr("Корчмар вирвав з гаманця останнє і покликав варту. Місто оголосило тебе шахраєм.","The innkeeper snatched what little was left and called the watch. The city has branded you a cheat.")}`;
      lockCity(currentCity,"dice_debt");
      setTimeout(openCityLockModal,800);
    }
  }else{
    result=`🤝 ${tr("Нічия. Ставки повертаються.","Draw. Stakes returned.")}`;
  }
  document.getElementById("diceResult").innerText=result;
  document.getElementById("diceModal").classList.remove("hidden");
  saveGame(false);
  render();
}
function closeDiceModal(){document.getElementById("diceModal").classList.add("hidden");}
// v0.43: find best places to buy a good (lowest current buy price with stock)
function bestSourcesFor(goodName,limit=3){
  if(!markets||!markets.length) return [];
  const sources=[];
  for(let i=0;i<markets.length;i++){
    if(i===quest_destinationGuard(i)) {} // noop; just iterate
    const m=markets[i];
    if(!m||!m.goods) continue;
    const g=m.goods.find(x=>x.name===goodName);
    if(!g||g.stock<=0) continue;
    sources.push({city:i,price:g.buy,stock:g.stock,supplies:(cities[i].supply||[]).includes(goodName)});
  }
  sources.sort((a,b)=>a.price-b.price || b.stock-a.stock);
  return sources.slice(0,limit);
}
function quest_destinationGuard(){return -1;} // placeholder to keep linter happy
function renderQuestDock(){
  const dock=document.getElementById("activeQuestDock");
  if(!dock) return;
  const active=activeQuests();
  const emptyTxt=tr("Немає активних завдань.","No active quests.");
  const guildLbl=tr("Гільдія","Guild");
  const mayorLbl=tr("Мерія","City council");
  const boughtLbl=tr("Куплено","Bought");
  const deliveredLbl=tr("Доставлено","Delivered");
  const byDayLbl=tr("До дня","By day");
  const buyHintLbl=tr("📍 Купити в","📍 Buy at");
  const hereLbl=tr("ти тут","you are here");
  const deliverLbl=tr("📤 Здати","📤 Deliver");
  const alsoLbl=tr("Альтернатива","Alternative");
  dock.innerHTML=active.length?active.map(quest=>{
    const owned=Math.min(inventoryCount(quest.good),Math.max(0,quest.qty-(quest.delivered||0)));
    const acquired=Math.max(quest.acquired||0,owned+(quest.delivered||0));
    const needed=acquired<quest.qty;
    let hintHtml="";
    if(needed){
      const localPrice=markets[currentCity]&&markets[currentCity].goods.find(g=>g.name===quest.good)&&markets[currentCity].goods.find(g=>g.name===quest.good).buy;
      // Primary: quest.source (where guild/council expects sourcing)
      let primaryLine="";
      const srcCity=quest.source;
      if(typeof srcCity==="number" && cities[srcCity]){
        const srcMarket=markets[srcCity]&&markets[srcCity].goods.find(g=>g.name===quest.good);
        const srcPrice=srcMarket?srcMarket.buy:"?";
        const srcStock=srcMarket?srcMarket.stock:0;
        const here=srcCity===currentCity?` <b style="color:#5ebd72">(${hereLbl})</b>`:"";
        let saving="";
        if(localPrice && srcMarket && srcMarket.buy<localPrice && srcCity!==currentCity){
          const pct=Math.round((1-srcMarket.buy/localPrice)*100);
          saving=` <span class="quest-saving">-${pct}%</span>`;
        }
        const stockNote=srcStock<=0?` <span style="color:#cd5148">(${tr("немає в продажу","sold out")})</span>`:"";
        primaryLine=`<div class="quest-source-line quest-source-primary">⭐ <b>${escapeHtml(cityName(srcCity))}</b>: 💰${srcPrice}${saving}${here}${stockNote}</div>`;
      }
      // Secondary: cheapest other city (in case source is sold out or too far)
      let altLine="";
      const others=bestSourcesFor(quest.good,4).filter(s=>s.city!==srcCity);
      if(others.length){
        const s=others[0];
        const here=s.city===currentCity?` <b style="color:#5ebd72">(${hereLbl})</b>`:"";
        let saving="";
        if(localPrice && s.price<localPrice && s.city!==currentCity){
          const pct=Math.round((1-s.price/localPrice)*100);
          saving=` <span class="quest-saving">-${pct}%</span>`;
        }
        altLine=`<div class="quest-source-line">${alsoLbl}: <b>${escapeHtml(cityName(s.city))}</b>: 💰${s.price}${saving}${here}</div>`;
      }
      hintHtml=`<div class="quest-source-hint"><div class="quest-source-label">${buyHintLbl}:</div>${primaryLine}${altLine}</div>`;
    }
    const deliverLine=`<div class="quest-source-line"><b>${deliverLbl}:</b> ${escapeHtml(cityName(quest.destination))} (${tr("до дня","by day")} ${quest.deadline||"?"})</div>`;
    return `<div class="dock-quest"><div class="dock-quest-head"><b>${quest.kind==="guild"?guildLbl:mayorLbl}:</b> ${escapeHtml(goodName(quest.good))} ×${quest.qty}</div><div class="dock-quest-progress">${boughtLbl}: ${Math.min(acquired,quest.qty)}/${quest.qty} • ${deliveredLbl}: ${quest.delivered||0}/${quest.qty}</div>${deliverLine}${hintHtml}</div>`;
  }).join(""):`<div class="empty">${emptyTxt}</div>`;
}
function findOwnedAny(id){return ownedPeople().find(person=>person.id===id);}
function setActiveTab(tabId){
  if(tabId==="caravan" && !CARAVAN_ENABLED) tabId="market";
  // v0.43: legacy tab IDs redirect into Square sub-tabs
  if(tabId==="guild"){tabId="square";currentSquareSub="guild";}
  else if(tabId==="shop"){tabId="square";currentSquareSub="shop";}
  else if(tabId==="people"){tabId="square";currentSquareSub="people";}
  activeTab=tabId;
  document.querySelectorAll(".nav").forEach(button=>{button.classList.remove("active");if(button.dataset.tab===tabId) button.classList.add("active");});
  document.querySelectorAll(".tab").forEach(tab=>{tab.classList.remove("active");if(tab.id===tabId) tab.classList.add("active");});
  const dropdown=document.getElementById("mobileTabDropdown");
  if(dropdown && dropdown.value!==tabId) dropdown.value=tabId;
  const nav=document.querySelector(".side-nav");
  if(nav) nav.classList.remove("menu-open");
  renderTab(tabId);
  collapseMobileDetails();
}
function toggleMobileMenu(){
  const nav=document.querySelector(".side-nav");
  if(nav) nav.classList.toggle("menu-open");
}
function toggleActionDock(){
  const dock=document.querySelector(".action-dock");
  if(!dock) return;
  dock.classList.toggle("dock-expanded");
  const btn=dock.querySelector(".dock-toggle-btn");
  if(btn) btn.innerText=dock.classList.contains("dock-expanded")?"▼":"▲";
}
// v0.43+: collapsible desktop UI (side-nav + action-dock).
// IMPORTANT: action-dock is a SIBLING of .app-shell, not a child.
// We therefore put the collapse classes on <body> so the CSS can target both.
const COLLAPSE_KEY="merchant_ui_collapsed_v40";
function toggleCollapsedUI(){
  const isCollapsed=document.body.classList.toggle("nav-collapsed");
  document.body.classList.toggle("dock-collapsed",isCollapsed);
  // Mirror on app-shell for backward compat
  const shell=document.getElementById("appShell");
  if(shell){shell.classList.toggle("nav-collapsed",isCollapsed);shell.classList.toggle("dock-collapsed",isCollapsed);}
  try{localStorage.setItem(COLLAPSE_KEY,isCollapsed?"1":"0");}catch(e){}
}
function applySavedCollapsedUI(){
  let saved="0";
  try{saved=localStorage.getItem(COLLAPSE_KEY)||"0";}catch(e){}
  if(saved==="1"){
    document.body.classList.add("nav-collapsed");
    document.body.classList.add("dock-collapsed");
    const shell=document.getElementById("appShell");
    if(shell){shell.classList.add("nav-collapsed");shell.classList.add("dock-collapsed");}
  }
}
function bindCollapseTapHandlers(){
  const nav=document.querySelector(".side-nav");
  const dock=document.querySelector(".action-dock");
  if(nav) nav.addEventListener("click",e=>{
    if(!document.body.classList.contains("nav-collapsed")) return;
    if(!nav.classList.contains("tapped")){
      e.stopPropagation();
      if(dock) dock.classList.remove("tapped");
      nav.classList.add("tapped");
    }
  });
  if(dock) dock.addEventListener("click",e=>{
    if(!document.body.classList.contains("dock-collapsed")) return;
    if(!dock.classList.contains("tapped") && !e.target.closest("button")){
      if(nav) nav.classList.remove("tapped");
      dock.classList.add("tapped");
    }
  });
  document.addEventListener("click",e=>{
    if(nav && nav.classList.contains("tapped") && !nav.contains(e.target)) nav.classList.remove("tapped");
    if(dock && dock.classList.contains("tapped") && !dock.contains(e.target)) dock.classList.remove("tapped");
  });
}
function openNpcProfile(id,returnTab){
  if(!findOwnedAny(id)) return;
  selectedProfileId=id;
  profileReturnTab=returnTab||"subordinates";
  setActiveTab("profile");
}
function closeNpcProfile(){
  selectedProfileId=null;
  setActiveTab(profileReturnTab||"subordinates");
}
function leaveProfileIfRemoved(id){
  if(selectedProfileId===id) closeNpcProfile();
}
function renderEquipment(person){
  const slots=Object.entries(giftSlots).map(([slot,label])=>{
    const item=itemById(person.equipment[slot]);
    return `<div class="equipment-slot"><h4>${label}</h4>${item?`<b class="quality-name-${itemRarity(item).colorClass}">${item.name}</b><br>${rarityBadge(item)}<br><span class="muted">${itemEffectText(item)}</span>${item.lore?`<span class="item-lore">${item.lore}</span>`:""}<div class="trade-actions"><button class="btn gray" onclick="unequipGift('${slot}',${person.id})">Зняти</button></div>`:`<span class="muted">Порожньо</span>`}</div>`;
  }).join("");
  const eligible=itemCatalog.filter(item=>canEquipItem(person,item) && itemStock(item.id)>0);
  const available=eligible.length?eligible.map(item=>`<button class="btn green quality-button-${itemRarity(item).colorClass}" onclick="equipGift('${item.id}',${person.id})">${item.name} (${giftSlots[item.slot]})</button>`).join(""):`<span class="muted">У запасі немає відповідних речей. Придбайте їх у крамниці або знайдіть у подорожі.</span>`;
  return `<div class="equipment-slots">${slots}</div><div class="trade-actions">${available}</div>`;
}
function interactionEffectText(interaction){
  const labels={
    bond:tr("Зв'язок","Bond"),affection:tr("Прихильність","Affection"),trust:tr("Довіра","Trust"),
    love:tr("Любов","Love"),loyalty:tr("Лояльність","Loyalty"),health:tr("Здоров'я","Health")
  };
  return Object.entries(interaction.effects).map(([stat,value])=>`${labels[stat]||stat} ${value>=0?"+":""}${value}`).join(", ");
}
function skillBenefitText(person){
  return tr(
    `Сила: склад, стайня та місткість. Ремесло: кухня, кузня й ткацький цех. Бій: тренування та захист караванів. Гостинність: дохід таверни. Лояльність і здоров'я: ефективність будь-якої роботи.${person.status==="slave"?" Покірність: продуктивність підневільної праці та розвиток статусу.":" Покірність враховується для підневільних NPC."}`,
    `Strength: warehouse, stable, capacity. Craft: kitchen, smithy, weaving. Combat: training, caravan defence. Hospitality: tavern income. Loyalty and Health: effectiveness of any work.${person.status==="slave"?" Obedience: bonded labour productivity and status growth.":" Obedience counts for bonded NPCs."}`
  );
}
function renderRelationships(person){
  const love=person.childOf?"":`<span class="badge">${tr("Любов","Love")}: ${person.love} / 100</span>`;
  const doLbl=tr("Виконати","Do it");
  const controls=availableInteractions(person).map(interaction=>`<div class="interaction-choice"><b>${interaction.name}</b><span class="muted">${interaction.desc}</span><span class="muted">${interactionEffectText(interaction)}</span><button class="btn ${interaction.effects.bond<0?"gray":"blue"}" onclick="interactWithNPC(${person.id},'${interaction.id}')">${doLbl}${interaction.cost?" ("+interaction.cost+")":""}</button></div>`).join("");
  let familyActions="";
  if(romanticEligible(person) && !person.spouse && relationshipRank(person)>=9 && !person.privateRoom) familyActions+=`<button class="btn green" onclick="furnishPrivateRoom(${person.id})">${tr("Облаштувати кімнату","Furnish room")} (260)</button>`;
  if(romanticEligible(person) && !person.spouse && person.privateRoom) familyActions+=`<button class="btn green" onclick="proposeMarriage(${person.id})">${tr("Запропонувати шлюб","Propose marriage")}</button>`;
  if(person.spouse && person.gender==="female") familyActions+=`<button class="btn green" onclick="planChild(${person.id})">${person.pregnantUntil?tr("Очікується дитина: день ","Expecting child: day ")+person.pregnantUntil:tr("Планувати дитину","Plan a child")+" (80)"}</button>`;
  const boundary=person.status==="slave"||person.status==="serf"?`<p class="muted">${tr("Довіра може зростати, але шлюб доступний лише після набуття свободи.","Trust can grow, but marriage is available only after freedom.")}</p>`:"";
  const child=person.childOf?`<p class="muted">${person.status==="child"?tr("Дитина зростає у родині й зможе працювати після досягнення 18 років.","The child grows in the family and may work after reaching 18 years."):tr("Повнолітня дитина головного героя може працювати, але її зв'язок із героєм залишається родинним.","An adult child of the hero may work, but their bond with the hero remains familial.")}</p>`:"";
  return `<div class="relation-head"><b>${tr("Рівень","Level")} ${relationshipRank(person)} / 10: ${relationshipLabel(person)}</b></div><div class="relation-meter"><span style="width:${person.bond}%"></span></div><span class="badge">${tr("Зв'язок","Bond")}: ${person.bond} / 100</span><span class="badge">${tr("Прихильність","Affection")}: ${person.affection} / 100</span><span class="badge">${tr("Довіра","Trust")}: ${person.trust} / 100</span>${love}<p class="muted">${tr("Доступні взаємодії","Available interactions")}:</p><div class="interaction-grid">${controls}</div><div class="trade-actions">${familyActions}</div>${boundary}${child}`;
}
function dialogueLine(person){
  const rank=relationshipRank(person);
  const first=displayFirstName(person);
  if(person.status==="slave" && person.obedience<5) return tr(`${person.name} відповідає коротко й обережно. У погляді більше страху, ніж довіри.`,`${first} answers shortly and warily. Their eyes hold more fear than trust.`);
  if(rank>=9) return tr(`${person.name} говорить відкрито: про втому, надії і те, чого чекає від майбутнього торгового дому.`,`${first} speaks openly: about weariness, hopes, and what they expect from the trading house's future.`);
  if(rank>=6) return tr(`${person.name} уже не ховається за сухими відповідями й згадує те, що зазвичай лишає при собі.`,`${first} no longer hides behind dry answers and shares what they usually keep to themselves.`);
  if(person.loyalty<5) return tr(`${person.name} слухає, але тримає дистанцію. Слова про турботу поки звучать непереконливо.`,`${first} listens but keeps distance. Words of care sound unconvincing so far.`);
  return tr(`${person.name} чемно вітається і чекає, що саме ти хочеш обговорити.`,`${first} greets politely and waits to hear what you want to discuss.`);
}
function openRelationshipDialog(id){
  const person=findOwnedAny(id);
  if(!person) return;
  document.getElementById("relationshipTitle").innerText=tr("Стосунки і діалог: ","Relations & dialog: ")+profileName(person);
  document.getElementById("relationshipText").innerText=dialogueLine(person);
  document.getElementById("relationshipContent").innerHTML=renderRelationships(person);
  document.getElementById("relationshipModal").classList.remove("hidden");
}
function closeRelationshipDialog(){document.getElementById("relationshipModal").classList.add("hidden");}
function renderNpcProfile(){
  const target=document.getElementById("npcProfile");
  if(!target) return;
  const person=findOwnedAny(selectedProfileId);
  if(!person){
    target.innerHTML=`<div class="panel empty">${tr("Оберіть працівника або раба у відповідному списку, щоб відкрити його особову справу.","Choose a worker or bonded person from the matching list to open their profile.")}</div>`;
    return;
  }
  const images=fullPortraitPaths(person);
  const portrait=images.shift();
  // v0.43: use women-panel atlas for free female NPCs in full-portrait too
  const fullPortraitHtml=getWomenPanelIndex(person)>=0
    ? `<div class="women-panel-portrait" style="background-position-x:${(getWomenPanelIndex(person)/(WOMEN_PANEL_SETS.length-1))*100}%"></div>`
    : `<img src="${portrait}" data-fallbacks="${images.join("|")}" data-icon="${person.status==="slave"?"⛓️":"🧍"}" onerror="nextPortrait(this)">`;
  const total=person.earningsTotal||0;
  const average=person.earningsDays?Math.round(total/person.earningsDays):0;
  const longevity=person.longLived?`<span class="badge relation-rank">${tr("Навичка","Skill")}: ${tr("Довгожитель","Long-lived")}</span>`:"";
  const access=person.locationCity===currentCity?`<span class="badge effect-positive">${tr("У тому самому місті","In the same city")}</span>`:`<div class="economy-note">${tr("NPC перебуває у місті","NPC is in the city of")} <b>${cityName(person.locationCity)}</b>. ${tr("Взаємодії недоступні, доки герой не прибуде туди.","Interactions unavailable until the hero arrives there.")}</div>`;
  const nameActions=`<button class="btn blue" onclick="renameNPC(${person.id},'nickname')">${person.nickname?tr("Змінити прізвисько","Change nickname"):tr("Дати прізвисько","Give nickname")}</button>${person.childOf?`<button class="btn blue" onclick="renameNPC(${person.id},'name')">${tr("Дати ім'я","Give name")}</button>`:""}<button class="btn blue" onclick="openRelationshipDialog(${person.id})">${tr("Стосунки і діалог","Relations & dialog")}</button>`;
  const lbl={
    personality:tr("Особистість","Personality"),trait:tr("Характеристика","Trait"),preferences:tr("Вподобання","Preferences"),
    gifts:tr("Подарунки та забезпечення","Gifts & equipment"),pay:tr("Платня та внесок","Pay & contribution"),
    name:tr("Ім'я","Name"),nickname:tr("Прізвисько","Nickname"),surname:tr("Прізвище","Surname"),
    from:tr("Звідки","From"),at:tr("Перебуває","Located"),family:tr("Сімейний стан","Family status"),
    together:tr("Разом із домом","Together with house"),job:tr("Робота","Job"),none:tr("немає","none"),
    likes:tr("Любить","Likes"),dislikes:tr("Не любить","Dislikes"),back:tr("Назад","Back"),
    age:tr("Вік","Age"),earnedTotal:tr("монет зароблено загалом","coins earned in total"),
    lastDay:tr("Останній день","Last day"),daysIncome:tr("Днів із прибутком","Days with income"),
    avgContrib:tr("Середній внесок","Avg contribution"),goodsProduced:tr("Виготовлено товарів","Goods produced"),
    longLivedDesc:tr("старість більше не загрожує цьому NPC.","old age no longer threatens this NPC."),
    longLivedTag:tr("Довгожитель","Long-lived"),days:tr("дн.","d.")
  };
  target.innerHTML=`<div class="profile-shell"><div class="panel"><div class="full-portrait">${fullPortraitHtml}</div></div><div class="panel"><div class="profile-header"><div><h2>${htmlName(person)}</h2><span class="badge">${statusLabel(person)} • ${escapeHtml(person.profession)}</span><span class="badge">${lbl.age}: ${person.age}</span><span class="badge">${compensationText(person)}</span>${longevity}${access}</div><button class="btn gray" onclick="closeNpcProfile()">${lbl.back}</button></div><div class="profile-grid"><div class="profile-block"><h3>${lbl.personality}</h3><b>${lbl.name}:</b> ${escapeHtml(displayFirstName(person))}<br><b>${lbl.nickname}:</b> ${person.nickname?escapeHtml(person.nickname):lbl.none}<br><b>${lbl.surname}:</b> ${escapeHtml(displaySurname(person))}<br><b>${lbl.from}:</b> ${escapeHtml(cityNameByName(person.homeCity)||person.homeCity)}<br><b>${lbl.at}:</b> ${cityName(person.locationCity)}<br><b>${lbl.family}:</b> ${escapeHtml(person.familyStatus)}<br><b>${lbl.together}:</b> ${person.daysTogether} ${lbl.days}<br><b>${lbl.job}:</b> ${escapeHtml(person.job)}<div class="trade-actions">${nameActions}</div></div><div class="profile-block"><h3>${lbl.trait}</h3><b>${escapeHtml(person.trait.name)}</b> (${escapeHtml(person.trait.effect)})<br>${escapeHtml(person.trait.description)}${person.longLived?`<br><br><b>${lbl.longLivedTag}:</b> ${lbl.longLivedDesc}`:""}</div><div class="profile-block"><h3>${tr("Історія","Story")}</h3>${escapeHtml(person.story)}<br><br>${escapeHtml(displayFirstName(person))} ${escapeHtml(person.hope)}.</div>${aspirationBlockHtml(person)}<div class="profile-block"><h3>${lbl.preferences}</h3><b>${lbl.likes}:</b> ${escapeHtml(person.likes)}.<br><b>${lbl.dislikes}:</b> ${escapeHtml(person.dislikes)}.</div><div class="profile-block"><h3>${tr("Навички","Skills")}</h3>${statRowHtml(person,"strength",tr("Сила","Strength"))}${statRowHtml(person,"craft",tr("Ремесло","Craft"))}${statRowHtml(person,"combat",tr("Бій","Combat"))}${statRowHtml(person,"service",tr("Гостинність","Hospitality"))}${statRowHtml(person,"loyalty",tr("Лояльність","Loyalty"))}${statRowHtml(person,"obedience",tr("Покірність","Obedience"))}${statRowHtml(person,"health",tr("Здоров'я","Health"))}<p class="muted">${skillBenefitText(person)}</p></div><div class="profile-block"><h3>${lbl.pay}</h3><p>${compensationDetail(person)}</p><div class="earning-total">+${total}</div>${lbl.earnedTotal}<br>${lbl.lastDay}: <b>+${person.lastIncome||0}</b><br>${lbl.daysIncome}: <b>${person.earningsDays||0}</b><br>${lbl.avgContrib}: <b>+${average}</b><br>${lbl.goodsProduced}: <b>${person.goodsProduced||0}</b></div><div class="profile-block profile-wide"><h3>${lbl.gifts}</h3>${renderEquipment(person)}</div></div><div class="profile-actions actions">${managerActions(person,false)}</div></div></div>`;
}

function renderRoutes(){
  if(!CARAVAN_ENABLED){
    document.getElementById("activeCaravans").innerHTML=`<h2 class="subhead">У дорозі</h2><div class="empty">Караванна система тимчасово прихована в білді v0.43. Поточні каравани, якщо вони були у старому збереженні, ще можуть завершити шлях.</div>`;
    document.getElementById("routes").innerHTML="";
    return;
  }
  const ongoing = activeCaravans.length ? activeCaravans.map(c=>`<div class="voyage-line"><span><b>${escapeHtml(c.name)}</b>: ${c.qty} × ${escapeHtml(goodName(c.good))}</span><span>${c.remaining} ${tr("дн. до прибуття","d. to arrival")}</span></div>`).join("") : `<div class="empty">${tr("У дорозі немає караванів.","No caravans on the road.")}</div>`;
  document.getElementById("activeCaravans").innerHTML=`<h2 class="subhead">${tr("У дорозі","On the road")}</h2>${ongoing}`;
  const cargo = Object.entries(inventory).filter(entry=>entry[1]>0);
  const available = availableRoutesFrom(currentCity).sort((a,b)=>a.days-b.days).slice(0,8);
  document.getElementById("routes").innerHTML=`<h2 class="subhead">${tr("Маршрути з міста","Routes from")} ${cityName(currentCity)}</h2><div class="route-grid">${available.map(r=>{
    const speed = caravanDuration(r);
    const choices = cargo.length ? cargo.map(([name,qty])=>`<button class="btn green" onclick="sendCaravan(${r.id},'${name}',1)">1 × ${goodName(name)}</button><button class="btn blue" onclick="sendCaravan(${r.id},'${name}',${Math.min(5,qty)})">${tr("до 5 ×","up to 5 ×")} ${goodName(name)}</button>`).join("") : `<span class="muted">${tr("На складі немає вантажу.","No cargo in storage.")}</span>`;
    return `<div class="card"><div class="card-title"><b>${escapeHtml(routeName(r))}</b><span class="badge">${tr("Ризик","Risk")}: ${riskLabel(r.risk)}</span></div><span class="badge">${tr("Час","Time")}: ${speed} ${tr("дн.","d.")}</span><span class="badge">${tr("Мито","Toll")}: ${r.fee} ${tr("монет або 20% вантажу без грошей","coins or 20% of cargo if short on money")}</span><div class="cargo-actions">${choices}</div></div>`;
  }).join("")}</div>`;
}

function renderRooms(){
  if(!hasHeadquarters()){
    document.getElementById("roomTabs").innerHTML="";
    document.getElementById("roomContent").innerHTML=`<div class="construction-card"><h2>🏰 ${tr("Штаб ще не засновано","Headquarters not yet founded")}</h2><p>${tr("Головний герой перебуває у місті","The hero is in")} <b>${cityName(currentCity)}</b>. ${tr("Тут можна створити дім торговця і розпочати розвиток штабу, або спершу вирушити до іншого міста.","Here you may build the merchant's house and start developing the headquarters, or travel to another city first.")}</p><button class="btn green" onclick="establishHeadquarters()">${tr("Заснувати штаб у місті","Found HQ in")} ${cityName(currentCity)} (${BALANCE.headquartersCost})</button></div>`;
    document.getElementById("familyRooms").innerHTML="";
    return;
  }
  document.getElementById("roomTabs").innerHTML=rooms.map((r,i)=>`<button class="room-tab ${i===currentRoom?"active":""} ${r.unlocked?"":"locked"}" onclick="selectRoom(${i})">${r.icon} ${r.name}${r.unlocked?"":" 🔒"}</button>`).join("");
  const r=rooms[currentRoom];
  const remoteNotice=!atHeadquarters()?`<div class="economy-note">Штаб розташований у місті <b>${cities[player.headquartersCity].name}</b>. Звідси можна оглядати стан будівель, але для будівництва, облаштування та роботи з NPC потрібно повернутися до штабу.</div>`:"";
  const art=`<div class="room-art"><img src="assets/hq/${r.image}.png" onerror="this.style.display='none'"><span class="art-placeholder">Зображення приміщення</span></div>`;
  if(!r.unlocked){
    document.getElementById("roomContent").innerHTML=remoteNotice+`<div class="room-layout"><div>${art}</div><div class="construction-card"><h2>${r.icon} ${r.name}</h2><p>${r.desc}</p><p class="muted">Ця локація ще не належить штабу. Відкрийте її, щоб призначати NPC та облаштовувати предметами.</p><button class="btn green" onclick="buildRoom('${r.key}')" ${atHeadquarters()?"":"disabled"}>Збудувати / відновити (${r.buildCost})</button></div></div>`;
    return;
  }
  const done=roomActionsUsed[r.key]===day;
  const staff=r.job?assignedStaff(r.job):[];
  const staffing=r.job?(staff.length?staff.map(person=>`<b>${htmlName(person)}</b> (${statusLabel(person)}, ${skillLabel(r.skill)} ${person[r.skill]})`).join("<br>"):"Ніхто не призначений. Приміщення не дає робочого ефекту."):"Призначення не потрібне.";
  const earning=["forge","weaving","jewelry","furniture","stable","house","inn"].includes(r.key)?`<span class="badge">Дохід: +${dailyRoomIncome(r.key)} / день</span>`:"";
  const furnishSlots=Array.from({length:5},(_,index)=>{
    const item=homeItemById((r.furnishings||[])[index]);
    return `<div class="furniture-slot">${item?`${item.icon}<b class="quality-name-${itemRarity(item).colorClass}">${item.name}</b>${rarityBadge(item)}<button class="btn gray" onclick="removeFurniture('${r.key}',${index})">Зняти</button>`:`<span class="muted">Вільний слот</span>`}</div>`;
  }).join("");
  const suitable=homeItemCatalog.filter(item=>homeStock(item.id)>0 && item.rooms.includes(r.key)).map(item=>`<button class="btn green quality-button-${itemRarity(item).colorClass}" onclick="furnishRoom('${r.key}','${item.id}')">${item.name}</button>`).join("")||`<span class="muted">У запасі немає доречних предметів для цього приміщення.</span>`;
  const homeRepairs=r.key==="house"?`<div class="workshop-actions"><b>Відновлення дому</b><div class="trade-actions">${r.kitchenRestored?`<span class="badge effect-positive">Кухню відновлено</span>`:`<button class="btn green" onclick="restoreHousePart('kitchen')">Відновити кухню (140)</button>`}${r.familyWingRestored?`<span class="badge effect-positive">Сімейні покої відновлено</span>`:`<button class="btn green" onclick="restoreHousePart('family')">Відновити покої родини (220)</button>`}</div><div class="house-rooms"><b>Кімнати звичайних NPC</b><span class="badge">Відкрито: ${r.freeRooms||0} / ${BALANCE.maxHouseRooms}</span><span class="badge">Зайнято: ${unassignedHouseResidents().length}</span><span class="badge">Вільно: ${freeHouseRooms()}</span><div class="trade-actions"><button class="btn green" onclick="buildHouseRoom()" ${atHeadquarters()&&((r.freeRooms||0)<BALANCE.maxHouseRooms)?"":"disabled"}>Відкрити кімнату (${nextHouseRoomCost()})</button></div><p class="muted">NPC без роботи живуть у звичайних кімнатах. Родинні покої для чоловіків, дружин і дітей показані нижче окремим блоком.</p></div></div>`:"";
  const production=r.key==="forge"?`<div class="workshop-actions"><b>Виробництво коваля</b><div class="trade-actions"><button class="btn blue" onclick="craftWorkshop('forge','Інструменти')">Інструменти: 1 залізо</button><button class="btn blue" onclick="craftWorkshop('forge','Зброя')">Зброя: 2 заліза</button><button class="btn blue" onclick="craftWorkshop('forge','Обладунки')">Обладунки: 3 заліза + шкіра</button></div></div>`:r.key==="weaving"?`<div class="workshop-actions"><b>Виробництво ткача</b><div class="trade-actions"><button class="btn blue" onclick="craftWorkshop('weaving','Килими')">Килими: 2 вовни/льону</button><button class="btn blue" onclick="craftWorkshop('weaving','Одяг')">Одяг: 2 льону</button><button class="btn blue" onclick="craftWorkshop('weaving','Сумки')">Сумки: 2 шкіри</button><button class="btn blue" onclick="craftWorkshop('weaving','Шапки')">Шапки: 1 вовна</button></div></div>`:r.key==="jewelry"?`<div class="workshop-actions"><b>Виробництво ювеліра</b><div class="trade-actions"><button class="btn blue" onclick="craftWorkshop('jewelry','Прикраси')">Прикраси: срібло або 2 скла</button></div></div>`:r.key==="furniture"?`<div class="workshop-actions"><b>Виробництво столяра</b><div class="trade-actions"><button class="btn blue" onclick="craftWorkshop('furniture','Меблі')">Меблі: інструменти + шкіра</button></div></div>`:"";
  document.getElementById("roomContent").innerHTML=remoteNotice+`<div class="room-layout"><div>${art}<div class="card room-detail"><div class="card-title"><b>${r.icon} ${r.name}</b><span class="badge">Рівень ${r.level}</span></div><p>${r.desc}</p><p class="muted">${r.effect}</p><span class="badge">${r.stat}: +${r.bonus*r.level}</span>${earning}<span class="badge">Покращення: ${upgradeCost(r)} монет</span>${homeRepairs}${production}</div></div><div class="card"><h2>Облаштування</h2><p class="muted">До п'яти доречних предметів. Меблі однієї функції замінюють попередні.</p><div class="furniture-grid">${furnishSlots}</div><div class="trade-actions">${suitable}</div><div class="staff-list"><b>Призначені люди:</b><br>${staffing}</div><div class="trade-actions"><button class="btn" onclick="upgradeRoom(${currentRoom})" ${atHeadquarters()?"":"disabled"}>Покращити</button><button class="btn blue" onclick="useRoom('${r.key}')" ${done||!atHeadquarters()?"disabled":""}>${done?"Вже виконано сьогодні":r.action+" ("+r.cost+")"}</button></div></div></div>`;
}
function renderFamilyRooms(){
  const target=document.getElementById("familyRooms");
  if(!target) return;
  if(!hasHeadquarters()){target.innerHTML="";return;}
  const selected=rooms[currentRoom];
  if(!selected || selected.key!=="house"){target.innerHTML="";return;}
  const house=roomByKey("house");
  if(!house.familyWingRestored){
    target.innerHTML=`<h2 class="subhead">${tr("Сімейні покої","Family quarters")}</h2><div class="empty">${tr("Відновіть сімейні кімнати у вкладці «Дім торговця», щоб облаштовувати приватні покої.","Restore the family rooms in the «Merchant's house» tab to arrange private quarters.")}</div>`;
    return;
  }
  const privateRoomPeople=ownedPeople().filter(person=>person.privateRoom);
  const children=ownedHirelings.filter(person=>person.childOf);
  const privateRooms=privateRoomPeople.length?privateRoomPeople.map(person=>{
    const slots=Array.from({length:5},(_,index)=>{
      const item=homeItemById((person.privateFurnishings||[])[index]);
      return `<div class="furniture-slot">${item?`${item.icon}<b class="quality-name-${itemRarity(item).colorClass}">${item.name}</b><button class="btn gray" onclick="removePrivateFurniture(${person.id},${index})">Зняти</button>`:`<span class="muted">Вільний слот</span>`}</div>`;
    }).join("");
    const choices=homeItemCatalog.filter(item=>homeStock(item.id)>0&&suitableForPrivateRoom(item)).map(item=>`<button class="btn green" onclick="furnishPrivateRoomItem(${person.id},'${item.id}')">${item.name}</button>`).join("")||`<span class="muted">Потрібні доречні меблі з крамниці.</span>`;
    return `<div class="family-room private-furnished-room"><b>${htmlName(person)}</b><span class="badge">${person.spouse?"Подружня кімната":"Підготовлена кімната"}</span><span class="muted">${person.spouse?"Приватний простір родини.":"Кімната чекає на рішення про шлюб."}</span><div class="furniture-grid">${slots}</div><div class="trade-actions">${choices}</div></div>`;
  }).join(""):`<div class="empty">Приватних кімнат ще не облаштовано.</div>`;
  const familyChildren=children.length?children.map(child=>`<div class="family-room"><b>${htmlName(child)}</b><span class="badge">Вік: ${child.age}</span><span class="muted">Мати: ${escapeHtml(child.childOf.motherName)}. ${child.status==="child"?"До повноліття не працює.":"Повнолітній член родини."}</span></div>`).join(""):`<div class="empty">Дітей у родині поки немає.</div>`;
  target.innerHTML=`<h2 class="subhead">${tr("Сімейні покої","Family quarters")}</h2><p class="muted">${tr("Для кожного чоловіка або дружини потрібна окрема облаштована кімната.","Each spouse needs their own furnished room.")}</p><div class="family-room-grid">${privateRooms}</div><h2 class="subhead">${tr("Діти торгового дому","Children of the trading house")}</h2><div class="family-room-grid">${familyChildren}</div>`;
}
// v0.43: hero inventory cards with images and descriptions
function ownedItemCard(item){
  const quality=itemRarity(item).colorClass;
  const qty=itemStock(item.id);
  const slotName=item.slot?(giftSlots[item.slot]||item.slot):"";
  return `<div class="card shop-item owned-item quality-frame-${quality}"><div class="item-icon"><img src="${item.img}" onerror="this.remove();this.parentElement.innerHTML='${item.icon||"📦"}'"></div><div><div class="card-title"><b class="quality-name-${quality}">${escapeHtml(itemName(item))}</b>${slotName?`<span class="badge">${slotName}</span>`:""}<span class="badge owned-qty">×${qty}</span></div>${rarityBadge(item)}<p class="muted">${escapeHtml(item.desc||"")}</p><span class="badge">${itemEffectText(item)}</span>${item.lore?`<p class="item-lore">${escapeHtml(item.lore)}</p>`:""}</div></div>`;
}
function ownedHomeItemCard(item){
  const quality=itemRarity(item).colorClass;
  const qty=homeStock(item.id);
  const locations=item.rooms?item.rooms.map(key=>{const r=roomByKey(key);return r?r.name:key;}).join(", "):"";
  return `<div class="card shop-item owned-item quality-frame-${quality}"><div class="item-icon"><img src="${item.img}" onerror="this.remove();this.parentElement.innerHTML='${item.icon||"🪑"}'"></div><div><div class="card-title"><b class="quality-name-${quality}">${escapeHtml(itemName(item))}</b><span class="badge owned-qty">×${qty}</span></div>${rarityBadge(item)}<p class="muted">${escapeHtml(item.desc||"")}</p><span class="badge">${homeEffectText(item)}</span>${locations?`<span class="badge">${tr("Для","For")}: ${escapeHtml(locations)}</span>`:""}${item.lore?`<p class="item-lore">${escapeHtml(item.lore)}</p>`:""}</div></div>`;
}

function renderPlayerProfile(){
  const target=document.getElementById("playerProfile");
  if(!target || !player) return;
  const goods=Object.entries(inventory).filter(entry=>entry[1]>0).map(([name,qty])=>goodsLine(name,qty)).join("")||`<div class="empty">${tr("Товарів на складі немає.","No goods in storage.")}</div>`;
  // v0.43: rich item cards with images + descriptions instead of plain text lines
  const ownedGifts=itemCatalog.filter(item=>itemStock(item.id)>0);
  const gifts=ownedGifts.length
    ? `<div class="owned-items-grid">${ownedGifts.map(ownedItemCard).join("")}</div>`
    : `<div class="empty">${tr("Особистих речей у запасі немає.","No personal items in storage.")}</div>`;
  const ownedFurnishings=homeItemCatalog.filter(item=>homeStock(item.id)>0);
  const furnishings=ownedFurnishings.length
    ? `<div class="owned-items-grid">${ownedFurnishings.map(ownedHomeItemCard).join("")}</div>`
    : `<div class="empty">${tr("Обладнання для кімнат у запасі немає.","No room furnishings in storage.")}</div>`;
  const relationships=ownedPeople().slice().sort((a,b)=>relationshipRank(b)-relationshipRank(a)).map(person=>`<div class="inventory-line"><span>${htmlName(person)}<br><small class="muted">${relationshipLabel(person)}</small></span><b>${relationshipRank(person)} / 10</b></div>`).join("")||`<div class="empty">Близьких знайомств ще немає.</div>`;
  const relationshipsHtml=relationships.replace("Близьких знайомств ще немає.",tr("Близьких знайомств ще немає.","No close relationships yet."));
  const history=(player.history||[]).slice(0,12).map(text=>`<div class="inventory-line"><span>${escapeHtml(text)}</span></div>`).join("")||`<div class="empty">${tr("Історія тільки починається.","The story is only beginning.")}</div>`;
  const next=nextRankInfo();
  const base=rankInfo().xp;
  const progress=next?Math.round(((player.xp-base)/(next.xp-base))*100):100;
  const headquarters=hasHeadquarters()?cityName(player.headquartersCity):tr("не засновано","not founded");
  const birthCity=cityName(player.birthCity||0);
  const current=cityName(currentCity);
  const story=player.story||tr("Шлях торговця пишеться його вчинками.","A merchant's road is written by his deeds.");
  const xpLine=next
    ? " / "+next.xp+tr(" до звання «"," to rank “")+rankName(next)+tr("»","”")
    : tr(" • вершина кар'єри"," • career peak");
  target.innerHTML=`<div class="profile-shell"><div class="panel"><div class="full-portrait"><img src="assets/player/${player.portrait||"yakiv"}_full.png" data-icon="🧭" onerror="nextPortrait(this)"></div></div><div class="panel"><div class="hero-head"><div><h2>🧭 ${escapeHtml(player.name)}</h2><span class="badge">${tr("Народження","Born")}: ${player.born||CAMPAIGN_YEAR-player.age} ${tr("р.","AD")}, ${escapeHtml(birthCity)}</span><span class="badge">${tr("Вік","Age")}: ${player.age}</span></div><div><span class="badge">📍 ${escapeHtml(current)}</span><span class="badge">🏰 ${tr("Штаб","HQ")}: ${escapeHtml(headquarters)}</span></div></div><div class="profile-block profile-wide"><h3>${tr("Кар'єра: рівень","Career: level")} ${playerLevel()} / 15</h3><b>${escapeHtml(rankName(rankInfo()))}</b><div class="level-meter"><span style="width:${progress}%"></span></div><span class="muted">${tr("Досвід","XP")}: ${player.xp||0}${xpLine}</span><p class="muted">${escapeHtml(story)}</p></div><div class="hero-grid"><div class="profile-block"><h3>${tr("Стан торгового дому","Trading house status")}</h3><div class="hero-stat">${tr("Монети","Coins")}: <b>${gold}</b></div><div class="hero-stat">${tr("Їжа","Food")}: <b>${food}</b></div><div class="hero-stat">${tr("Репутація у місті","Reputation in")} ${escapeHtml(current)}: <b>${cityReputation(currentCity)}</b></div><div class="hero-stat">${tr("Дії сьогодні","Actions today")}: <b>${energy} / ${dailyActionLimit()}</b></div><div class="hero-stat">${tr("Дохід штабу","HQ income")}: <b>+${headquartersIncome()} / ${tr("день","day")}</b></div><p class="muted">${reputationLabel(currentCity)}</p></div><div class="profile-block"><h3>${tr("Товари","Goods")}</h3>${goods}</div><div class="profile-block"><h3>${tr("Речі й дарунки","Items and gifts")}</h3>${gifts}</div><div class="profile-block"><h3>${tr("Меблі штабу","HQ furniture")}</h3>${furnishings}</div><div class="profile-block"><h3>${tr("Взаємовідносини","Relationships")}</h3><div class="relation-list">${relationshipsHtml}</div></div><div class="profile-block"><h3>${tr("Історія розвитку","Development history")}</h3><div class="relation-list">${history}</div></div></div></div></div>`;
}
function logHtml(entry){return `<div class="log-entry log-${entry.type||"system"}">${t("status.day")} ${entry.day}: ${escapeHtml(entry.text)}</div>`;}
function renderLog(){
  const search=document.getElementById("journalSearch");
  const query=search?search.value.trim().toLowerCase():"";
  const visible=query?journal.filter(entry=>entry.text.toLowerCase().includes(query)):journal;
  const content=visible.length?visible.map(logHtml).join(""):`<div class="empty">${query?tr("Подій за таким запитом немає.","No events match this search."):tr("Подій ще немає.","No events yet.")}</div>`;
  document.getElementById("log").innerHTML=content;
  const dock=document.getElementById("actionLog");
  if(dock) dock.innerHTML=journal.slice(0,20).map(logHtml).join("")||`<div class="empty">${tr("Подій ще немає.","No events yet.")}</div>`;
}
function renderActionHeroDock(){
  const target=document.getElementById("actionHeroDock");
  if(!target) return;
  const companions=travelCompanionIds.map(id=>findOwnedAny(id)).filter(Boolean);
  const party=companions.length?companions.map(person=>`<div class="dock-companion">${portraitHtml(person)}<span>${htmlName(person)}</span></div>`).join(""):`<div class="muted">${tr("Дорожнього загону немає.","No travel party.")}</div>`;
  target.innerHTML=`<div class="dock-hero-card"><img src="assets/player/${player.portrait||"yakiv"}_portrait.png" onerror="this.style.display='none'"><div><b>${escapeHtml(player.name||tr("Герой","Hero"))}</b><span>📍 ${escapeHtml(cityName(currentCity))}</span><span>${t("status.level")} ${playerLevel()}: ${escapeHtml(rankName(rankInfo()))}</span></div></div><div class="dock-party-title">${tr("З героєм у дорозі","Travelling with the hero")}</div><div class="dock-party-list">${party}</div>`;
}
function selectRoom(index){currentRoom=index;renderRooms();renderFamilyRooms();}

function travelCost(destination){return Math.max(5,Math.round(travelPriceBetween(currentCity,destination)*diffMult("travelCostMult")));}
function eligibleTravelCompanions(origin=currentCity){
  return ownedPeople()
    .filter(person=>person.locationCity===origin && person.status!=="child" && person.job==="Без роботи" && !person.awayUntil)
    .sort((a,b)=>(b.combat+b.strength+b.health)-(a.combat+a.strength+a.health));
}
function requiredTravelCompanionIds(origin=currentCity){
  if(!hasHeadquarters() || origin===player.headquartersCity) return [];
  const available=new Set(eligibleTravelCompanions(origin).map(person=>person.id));
  return travelCompanionIds.filter(id=>available.has(id)).slice(0,4);
}
function travelParty(origin=currentCity,companionIds=null){
  const eligible=eligibleTravelCompanions(origin);
  if(Array.isArray(companionIds)){
    const ids=new Set(companionIds.map(Number));
    return eligible.filter(person=>ids.has(person.id)).slice(0,4);
  }
  return eligible.slice(0,4);
}
function travelCompanionPower(person){
  return person.combat*2+person.strength+person.health+Math.floor(person.loyalty/2);
}
function makeEnemyUnit(pool,index,difficulty){
  const baseHp=8+difficulty*2+rand(0,5);
  const hp=Math.max(3,Math.round(baseHp*diffMult("enemyHpMult")));
  return {
    name:poolEnemyName(pool,index),
    hp,
    maxHp:hp,
    attack:Math.max(1,Math.round((3+difficulty+rand(0,3))*diffMult("enemyAttackMult"))),
    defense:1+Math.floor(difficulty/2)
  };
}
function removeKilledNpc(person){
  ownedSlaves=ownedSlaves.filter(candidate=>candidate.id!==person.id);
  ownedHirelings=ownedHirelings.filter(candidate=>candidate.id!==person.id);
  leaveProfileIfRemoved(person.id);
}
// ==== v0.43: DD combat skills, ranks, stress ====
const DD_SKILL_NAMES={
  strike:{name:"Удар",nameEn:"Strike",desc:"Звичайна атака.",descEn:"Basic attack."},
  cleave:{name:"Розкол строю",nameEn:"Cleave",desc:"+60% шкоди, але -1 захист на 1 раунд.",descEn:"+60% damage, -1 defense for 1 round."},
  precise:{name:"Прицільний постріл",nameEn:"Precise shot",desc:"Гарантоване попадання, +крит шанс. Б'є по задньому ворогу.",descEn:"Guaranteed hit, +crit chance. Targets back enemy."},
  heal:{name:"Перев'язка",nameEn:"Bandage",desc:"Лікує союзника з найменшим HP. Без атаки.",descEn:"Heals lowest-HP ally. No attack."},
  berserk:{name:"Шалена атака",nameEn:"Berserk",desc:"Б'є 2 ворогів за 0.7× шкоди.",descEn:"Hits 2 enemies for 0.7x damage."}
};
function ddSkillLabel(key){const s=DD_SKILL_NAMES[key];return s?(lang==="en"?s.nameEn:s.name):key;}
function ddSkillDesc(key){const s=DD_SKILL_NAMES[key];return s?(lang==="en"?s.descEn:s.desc):"";}

const DD_SKILLS=[
  {key:"strike",icon:"⚔️",get name(){return ddSkillLabel("strike");},get desc(){return ddSkillDesc("strike");},
    available:()=>true,
    targetSide:"enemies",
    execute(actor,targets,state){
      const target=targets[0];
      const result=ddComputeAllyDamage(actor,target);
      return [{target,targetSide:"enemies",result}];
    }},
  {key:"cleave",icon:"💥",get name(){return ddSkillLabel("cleave");},get desc(){return ddSkillDesc("cleave");},
    available:(actor)=>(actor.person.combat||0)>=10,
    targetSide:"enemies",
    execute(actor,targets,state){
      const target=targets[0];
      const result=ddComputeAllyDamage(actor,target);
      result.damage=Math.ceil(result.damage*1.6);
      actor._defenseDebuff=(actor._defenseDebuff||0)+1;
      return [{target,targetSide:"enemies",result,note:"cleave"}];
    }},
  {key:"precise",icon:"🎯",get name(){return ddSkillLabel("precise");},get desc(){return ddSkillDesc("precise");},
    available:(actor)=>(actor.person.combat||0)>=8 && (actor.person.craft||0)>=6,
    targetSide:"enemies",
    pickTarget(state){
      const live=state.enemies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0);
      // pick last (back rank)
      return live.length?live[live.length-1].i:-1;
    },
    execute(actor,targets,state){
      const target=targets[0];
      const result=ddComputeAllyDamage(actor,target);
      result.isMiss=false;
      if(Math.random()<0.4){result.isCrit=true;result.damage=Math.ceil(result.damage*1.7);}
      return [{target,targetSide:"enemies",result,note:"precise"}];
    }},
  {key:"heal",icon:"➕",get name(){return ddSkillLabel("heal");},get desc(){return ddSkillDesc("heal");},
    available:(actor)=>(actor.person.service||0)>=10,
    targetSide:"allies",
    pickTarget(state){
      const live=state.allies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0 && x.u.hp<x.u.maxHp);
      if(!live.length) return -1;
      live.sort((a,b)=>a.u.hp-b.u.hp);
      return live[0].i;
    },
    execute(actor,targets,state){
      const target=targets[0];
      const heal=8+Math.floor((actor.person.service||0)/2);
      target.hp=Math.min(target.maxHp,target.hp+heal);
      target.stress=Math.max(0,(target.stress||0)-12);
      return [{target,targetSide:"allies",result:{damage:0,heal,isHeal:true,isMiss:false,isCrit:false},note:"heal"}];
    }},
  {key:"berserk",icon:"🔥",get name(){return ddSkillLabel("berserk");},get desc(){return ddSkillDesc("berserk");},
    available:(actor)=>(actor.person.strength||0)>=12,
    targetSide:"enemies",
    execute(actor,targets,state){
      const live=state.enemies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0).slice(0,2);
      return live.map(({u,i})=>{
        const result=ddComputeAllyDamage(actor,u);
        result.damage=Math.ceil(result.damage*0.7);
        return {target:u,targetIndex:i,targetSide:"enemies",result,note:"berserk"};
      });
    }}
];
function ddAvailableSkills(actor){
  return DD_SKILLS.filter(s=>s.available(actor));
}
function ddRankBonus(unit,allUnits){
  const idx=allUnits.indexOf(unit);
  const live=allUnits.filter(u=>u.hp>0).indexOf(unit);
  // Position 0-1 = front, 2-3 = back
  if(live<0) return {damageOut:1,damageIn:1};
  if(live<2) return {damageOut:1.2,damageIn:1.3};
  return {damageOut:0.85,damageIn:0.65};
}
function ddApplyStress(unit,amount){
  unit.stress=Math.min(150,(unit.stress||0)+amount);
}
function ddPanicCheck(unit){
  return (unit.stress||0)>=100 && Math.random()<0.45;
}

const DD_ENEMY_EMOJI={bandits:"🗡️",beasts:"🐺",raiders:"⚔️",caravan:"🛡️"};
function ddEnemyEmoji(pool){return DD_ENEMY_EMOJI[pool&&pool.kind]||"☠️";}
function ddUnitHtml(unit,side,index,extraClass=""){
  const fallen=unit.hp<=0?"fallen":"";
  const active=unit._active?"active":"";
  const target=unit._targeted?"target-highlight":"";
  const lunge=unit._lunge?(side==="allies"?"lunge-right":"lunge-left"):"";
  const struck=unit._struck?"struck":"";
  const pop=unit._pop?`<div class="dd-dmg-pop ${unit._pop.kind||""}">${unit._pop.text}</div>`:"";
  const pct=Math.max(0,Math.round((unit.hp/Math.max(1,unit.maxHp))*100));
  const hpBar=`<div class="dd-hp"><span style="width:${pct}%"></span></div>`;
  // Rank badge (1-4, 1 is front)
  const allUnits=side==="allies"?(ddCombatState?ddCombatState.allies:[]):(ddCombatState?ddCombatState.enemies:[]);
  const liveIdx=allUnits.filter(u=>u.hp>0).indexOf(unit);
  const rankNum=unit.hp>0?(liveIdx+1):"";
  const rankBadge=unit.hp>0?`<div class="dd-rank-badge" title="Ранг ${rankNum}">${rankNum}</div>`:"";
  const stress=unit.stress||0;
  const stressPct=Math.min(100,Math.round(stress));
  const stressBar=side==="allies"&&unit.hp>0?`<div class="dd-stress-bar ${stress>=100?"panic":""}"><span style="width:${stressPct}%"></span></div>`:"";
  if(side==="allies"){
    const portrait=portraitPaths(unit.person)[0];
    const name=htmlName(unit.person);
    const cmbLbl=tr("Бій","Cmb");
    const meta=`HP ${Math.max(0,unit.hp)}/${unit.maxHp} • ${cmbLbl} ${unit.person.combat}${stress>=100?" • 😱":""}`;
    // v0.43: women panel portraits in combat
    const womenIdx=getWomenPanelIndex(unit.person);
    const portraitMarkup=womenIdx>=0
      ? `<div class="women-panel-portrait" style="background-position-x:${(womenIdx/(WOMEN_PANEL_SETS.length-1))*100}%"></div>`
      : `<img src="${portrait}" onerror="this.style.display='none'">`;
    return `<div class="dd-unit ${extraClass} ${fallen} ${active} ${target} ${lunge} ${struck}" data-side="allies" data-index="${index}">${rankBadge}${pop}${portraitMarkup}<b>${name}</b><div class="dd-meta">${meta}</div>${hpBar}${stressBar}</div>`;
  }
  const emoji=ddEnemyEmoji({kind:unit.kind});
  const atkLbl=tr("Атк","Atk");
  const meta=`HP ${Math.max(0,unit.hp)}/${unit.maxHp} • ${atkLbl} ${unit.attack}`;
  return `<div class="dd-unit enemy ${extraClass} ${fallen} ${active} ${target} ${lunge} ${struck}" data-side="enemies" data-index="${index}">${rankBadge}${pop}<div class="dd-emoji">${emoji}</div><b>${escapeHtml(unit.name)}</b><div class="dd-meta">${meta}</div>${hpBar}</div>`;
}
function ddArenaHtml(state,opts={}){
  const allies=state.allies.map((u,i)=>ddUnitHtml(u,"allies",i)).join("");
  const enemies=state.enemies.map((u,i)=>ddUnitHtml(u,"enemies",i,opts.manualTarget?"":"")).join("");
  const turnHtml=state.turnOrder?state.turnOrder.map((t,i)=>{
    const u=t.side==="allies"?state.allies[t.index]:state.enemies[t.index];
    if(!u||u.hp<=0) return "";
    const label=t.side==="allies"?profileName(u.person):u.name;
    const cls=t.side+(i===state.turnPos?" current":"");
    return `<span class="dd-turn-chip ${cls}">${escapeHtml(label)}</span>`;
  }).join(""):"";
  const order=turnHtml?`<div class="dd-turn-order">${tr("Порядок ходу","Turn order")}: ${turnHtml}</div>`:"";
  return `<div class="dd-arena">${order}<div class="dd-ranks"><div class="dd-side allies">${allies}</div><div class="dd-side enemies">${enemies}</div></div></div>`;
}

// ==== Prose narrator ====
const DD_PROSE_UK={
  openings:{
    bandits:["З-під кущів вискакують {enemies} — дорогу перетнули розбійники.","У сутінках лісу зблиснули клинки: {enemies} оточили обоз.","Тиша лісу обірвалась криком — {enemies} налетіли на шлях."],
    beasts:["З гущавини вирвались {enemies}, голодні очі палають у темряві.","Глухе гарчання розкололо ніч — {enemies} взяли караван у кільце.","Хижий вереск пронизав повітря: {enemies} вийшли на ловитву."],
    raiders:["Гуркіт копит — {enemies} налетіли смерчем зі степу.","Степовий вітер приніс ворога: {enemies} зімкнулись навколо обозу.","Високим криком {enemies} кинулись в атаку."],
    caravan:["Чужий караван стає у бойовий стрій: {enemies} готові захищати своє добро.","Охорона чужого обозу вихоплює клинки — {enemies} приймають виклик.","Купецький конвой не здається без бою: {enemies} стоять стіною."]
  },
  hitLow:["{actor} легко зачіпає ціль — {target} отримує {dmg} шкоди.","Клинок {actor} ковзає по обладунку — {target} стогне від {dmg}.","Пробний випад: {target} приймає {dmg} шкоди.","Удар відбито бронею, та {target} все ж відчуває {dmg}."],
  hitMid:["{actor} проривається крізь захист — {target} приймає {dmg} шкоди.","Криваве жниво: {target} отримує {dmg} від лютого замаху.","Лютий випад знаходить ціль — {target} спливає кров'ю на {dmg}.","{actor} ламає стрій — {target} приймає {dmg} ран.","Сталь дзвенить, і {target} отримує {dmg} шкоди."],
  hitHigh:["Нищівний удар валить ціль з ніг — {target} приймає {dmg} шкоди.","{actor} вкладає всю лють у замах: {target} відлітає назад, втрачаючи {dmg}.","Як грім з небес — на {target} обрушується {dmg} ран.","Криваве полотно: {target} ледь стоїть після {dmg} шкоди."],
  crit:["⚡ КРИТИЧНИЙ УДАР! {actor} знаходить шпарину в обороні — {target} приймає {dmg}!","⚡ Ідеальний випад! Клинок проходить наскрізь — {target} отримує жахливі {dmg}.","⚡ Точно в горло — {target} захлинається кров'ю, втрачаючи {dmg}."],
  miss:["{actor} замахується, та ціль в останню мить ухиляється — {target} вислизає.","Сталь свистить у повітрі — {target} відскочив.","Промах! {target} парирує удар."],
  kill:["{target} падає на коліна, лишаючи по собі лише тінь.","Сухим тріском ламається тіло — {target} затихає назавжди.","Останній подих тоне у крові — {target} мертвий.","З глухим стогоном {target} осідає у багно — все скінчено."],
  victory:["Останній ворог падає. Дорога знову належить торговцям.","Бій стихає. На полі лиш стогін поранених та запах пороху й крові.","Перемога! Загін відсапується, рахуючи рани й здобич.","Шлях очищено. Сонце пробивається крізь криваву імлу."],
  defeat:["Сили вичерпались. Загін падає під натиском ворога — обоз втрачено.","Останній з твоїх людей валиться у пилюку. Темрява поглинає шлях.","Не вистачило ні сталі, ні відваги — поразка гірка й остаточна."]
};
const DD_PROSE_EN={
  openings:{
    bandits:[
      "Footpads burst from the brambles — {enemies} bar the road, knives bared.",
      "A whistle, then steel: {enemies} step from the treeline with murder in their eyes.",
      "The forest holds its breath as {enemies} close upon the caravan like wolves on a lamb."
    ],
    beasts:[
      "Yellow eyes flare in the dark — {enemies} surge from the brush, lean and hungry.",
      "A low growl splits the night; {enemies} ring the wagons, fangs already wet.",
      "The thicket disgorges its hunger: {enemies} circle, snarling, scenting the warmth of men."
    ],
    raiders:[
      "Hooves like a storm — {enemies} swarm in from the open country, screaming.",
      "Steel and dust: {enemies} crash against the column, banners ragged in the wind.",
      "The horizon spills warriors: {enemies} come on with the howl of a hungry tribe."
    ],
    caravan:[
      "The rival caravan forms a wall of shields — {enemies} will not give up their cargo lightly.",
      "Hired blades earn their pay: {enemies} step forward to defend the merchant's chest.",
      "The convoy locks ranks: {enemies} brace, jaws set, ready for blood."
    ]
  },
  hitLow:[
    "{actor} grazes the foe — {target} flinches, taking {dmg} damage.",
    "A glancing blow: {target} grits their teeth through {dmg} damage.",
    "Steel scrapes mail — {target} winces under {dmg} damage.",
    "{actor} pricks the guard; {target} bleeds for {dmg}."
  ],
  hitMid:[
    "{actor} carves a red line — {target} reels with {dmg} damage.",
    "A brutal cut: {target} stumbles, bleeding hard from {dmg} wounds.",
    "Bone meets steel — {target} cries out, taking {dmg} damage.",
    "{actor} drives the strike home — {target} staggers, {dmg} weaker.",
    "Iron bites flesh: {target} is opened for {dmg}."
  ],
  hitHigh:[
    "A devastating blow flings the foe back — {target} collapses inward, losing {dmg}.",
    "{actor} hews like a butcher: {target} folds beneath {dmg} damage.",
    "The strike lands like thunder — {target} chokes on blood, {dmg} ruined.",
    "Carmine flowers bloom across {target}: {dmg} of life pours into the mud."
  ],
  crit:[
    "⚡ CRITICAL STRIKE! {actor} finds the seam in the guard — {target} ruptures for {dmg}!",
    "⚡ A killing arc! Steel passes through cloth, leather and flesh — {target} takes a fearful {dmg}.",
    "⚡ The point finds the throat — {target} drowns in their own breath, {dmg} damage."
  ],
  miss:[
    "{actor} swings wide — {target} ducks beneath the blade.",
    "Steel whistles through empty air — {target} steps aside, smiling thinly.",
    "A clumsy stroke: {target} parries with a contemptuous flick."
  ],
  kill:[
    "{target} sinks to their knees and topples, lifeless.",
    "A wet, final cough — and {target} is no more.",
    "{target} crumples like a sack of grain; the eyes go dull.",
    "With a long sigh, {target} settles into the mud forever."
  ],
  victory:[
    "The last foe falls. The road belongs to merchants once more.",
    "Silence returns to the field. Only the dying groan beneath the wheels.",
    "Victory! The escort wipes its blades and counts both wounds and spoils.",
    "The path is cleared. Pale sun cuts through smoke and copper-bright air."
  ],
  defeat:[
    "Strength fails. The escort buckles, and the cargo is lost to greedy hands.",
    "The last man falls — darkness swallows the road and everything it carried.",
    "Neither steel nor courage was enough. The defeat is bitter and final."
  ]
};
function ddProseSet(){return lang==="en"?DD_PROSE_EN:DD_PROSE_UK;}
// Backward-compat for any code referencing DD_PROSE directly
const DD_PROSE=new Proxy({},{get(_,k){return ddProseSet()[k];}});
function pickProse(arr){return arr[Math.floor(Math.random()*arr.length)];}
function ddNarrate(template,vars){
  return template.replace(/\{(\w+)\}/g,(m,k)=>vars[k]!==undefined?vars[k]:m);
}
function ddProseTier(damage,maxHpRef){
  const pct=damage/Math.max(1,maxHpRef);
  if(pct<0.15) return "hitLow";
  if(pct<0.35) return "hitMid";
  return "hitHigh";
}
function ddOpeningProse(pool,enemies){
  const set=ddProseSet();
  const list=set.openings[pool.kind]||set.openings.bandits;
  const names=enemies.map(e=>e.name);
  const conj=lang==="en"?"and":"та";
  const fallback=lang==="en"?"foes":"вороги";
  const enemiesStr=names.length>1?`<span class="prose-enemy">${escapeHtml(names.slice(0,-1).join(", "))} ${conj} ${escapeHtml(names[names.length-1])}</span>`:`<span class="prose-enemy">${escapeHtml(names[0]||fallback)}</span>`;
  return ddNarrate(pickProse(list),{enemies:enemiesStr});
}
function ddActionProse(attacker,target,damage,isCrit,isMiss,isKill,attackerSide){
  const actorName=attackerSide==="allies"?profileName(attacker.person):attacker.name;
  const targetName=attackerSide==="allies"?(target.name||""):profileName(target.person);
  const actorCls=attackerSide==="allies"?"prose-actor":"prose-enemy";
  const targetCls=attackerSide==="allies"?"prose-enemy":"prose-actor";
  const actor=`<span class="${actorCls}">${escapeHtml(actorName)}</span>`;
  const targetStr=`<span class="${targetCls}">${escapeHtml(targetName)}</span>`;
  const dmgStr=`<span class="${isCrit?"prose-crit":"prose-dmg"}">${damage}</span>`;
  if(isMiss) return ddNarrate(pickProse(DD_PROSE.miss),{actor,target:targetStr});
  let tpl;
  if(isCrit) tpl=pickProse(DD_PROSE.crit);
  else tpl=pickProse(DD_PROSE[ddProseTier(damage,target.maxHp)]);
  let line=ddNarrate(tpl,{actor,target:targetStr,dmg:dmgStr});
  if(isKill) line+=` <span class="prose-fall">${ddNarrate(pickProse(DD_PROSE.kill),{target:targetStr})}</span>`;
  return line;
}

let ddCombatState=null;
let ddSkipAnim=false;
function ddSkipAnimation(){ddSkipAnim=true;}
function ddSleep(ms){return new Promise(r=>setTimeout(r,ddSkipAnim?0:ms));}
function ddBuildTurnOrder(state){
  const list=[];
  state.allies.forEach((u,i)=>list.push({side:"allies",index:i,speed:8+Math.floor(u.person.combat/3)+Math.random()*4}));
  state.enemies.forEach((u,i)=>list.push({side:"enemies",index:i,speed:6+Math.floor((u.attack||4)/2)+Math.random()*4}));
  list.sort((a,b)=>b.speed-a.speed);
  state.turnOrder=list;
}
function ddPickAllyTarget(state){
  const live=state.enemies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0);
  if(!live.length) return -1;
  // Prefer weakest enemy (DD-style focus fire)
  live.sort((a,b)=>a.u.hp-b.u.hp);
  return live[0].i;
}
function ddPickEnemyTarget(state){
  const live=state.allies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0);
  if(!live.length) return -1;
  live.sort((a,b)=>a.u.hp-b.u.hp);
  return live[0].i;
}
function ddComputeAllyDamage(unit,enemy){
  const base=rand(2,6)+Math.floor(unit.person.combat/3)+Math.floor(unit.person.strength/4);
  const debuff=(enemy._defenseDebuff||0);
  const dmg=Math.max(1,base-Math.max(0,(enemy.defense||0)-debuff));
  const rankMod=ddCombatState?ddRankBonus(unit,ddCombatState.allies).damageOut:1;
  const isCrit=Math.random()<0.12+Math.min(0.15,unit.person.combat/200);
  const isMiss=Math.random()<0.08;
  let finalDmg=Math.round(dmg*rankMod);
  if(isCrit) finalDmg=Math.ceil(finalDmg*1.8);
  return {damage:isMiss?0:finalDmg,isCrit,isMiss};
}
function ddComputeEnemyDamage(enemy,ally){
  const base=Math.max(1,(enemy.attack||4)-rand(0,Math.floor(ally.person.combat/5)));
  const rankMod=ddCombatState?ddRankBonus(ally,ddCombatState.allies).damageIn:1;
  const isCrit=Math.random()<0.07;
  const isMiss=Math.random()<0.1;
  let finalDmg=Math.round(base*rankMod);
  if(isCrit) finalDmg=Math.ceil(finalDmg*1.7);
  return {damage:isMiss?0:finalDmg,isCrit,isMiss};
}
function ddRender(){
  const state=ddCombatState;
  if(!state) return;
  document.getElementById("combatTitle").innerText=state.title;
  document.getElementById("combatText").innerText=state.subtitle||"";
  document.getElementById("combatArena").innerHTML=ddArenaHtml(state)+(state.manual&&state.awaitingPlayer?ddManualActionsHtml(state):"");
  const proseHtml=state.prose.map(p=>`<p>${p}</p>`).join("");
  document.getElementById("combatRounds").innerHTML=`<div class="dd-narration">${proseHtml}</div>`;
  const cr=document.getElementById("combatRounds");
  const nar=cr&&cr.querySelector(".dd-narration");
  if(nar) nar.scrollTop=nar.scrollHeight;
  const closeBtn=document.getElementById("combatCloseButton");
  if(closeBtn){
    closeBtn.disabled=!state.finished;
    closeBtn.innerText=state.finished?tr("Продовжити","Continue"):(state.manual?tr("Завершіть бій","Finish the fight"):tr("Битва триває...","Battle in progress..."));
  }
  const modalEl=document.getElementById("combatModal");
  const kind=(state.pool&&state.pool.kind)||"bandits";
  modalEl.setAttribute("data-combat-kind",kind);
  modalEl.classList.remove("hidden");
}
function ddManualActionsHtml(state){
  if(!state.awaitingPlayer) return "";
  const live=state.allies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0);
  if(!live.length) return "";
  const current=state.turnOrder[state.turnPos];
  if(!current||current.side!=="allies") return "";
  const ally=state.allies[current.index];
  const skills=ddAvailableSkills(ally);
  const selectedSkillKey=state.selectedSkill||"strike";
  const selectedSkill=skills.find(s=>s.key===selectedSkillKey)||skills[0];
  const skillBar=`<div class="dd-skill-bar"><b style="color:var(--gold);align-self:center;margin-right:8px">${tr("Хід","Turn")}: ${escapeHtml(profileName(ally.person))}</b>${skills.map(s=>`<button class="dd-skill ${s.key===selectedSkillKey?"selected":""}" onclick="ddSelectSkill('${s.key}')" title="${escapeHtml(s.desc)}"><span class="skill-icon">${s.icon}</span>${escapeHtml(s.name)}</button>`).join("")}<button class="btn gray" onclick="ddManualDefend()">🛡️ ${tr("Захист","Defend")}</button></div>`;
  // Target selector
  let targets;
  const pickLbl=tr("Обрати ціль","Pick target");
  if(selectedSkill.targetSide==="allies"){
    const liveAllies=state.allies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0);
    targets=`<div class="dd-manual-actions"><span style="color:var(--muted);align-self:center">${pickLbl}:</span>${liveAllies.map(a=>`<button class="btn green" onclick="ddManualUseSkill('${selectedSkill.key}',${a.i},'allies')">${selectedSkill.icon} ${escapeHtml(profileName(a.u.person))}</button>`).join("")}</div>`;
  }else{
    const liveEnemies=state.enemies.map((u,i)=>({u,i})).filter(x=>x.u.hp>0);
    targets=`<div class="dd-manual-actions"><span style="color:var(--muted);align-self:center">${pickLbl}:</span>${liveEnemies.map(e=>`<button class="btn red" onclick="ddManualUseSkill('${selectedSkill.key}',${e.i},'enemies')">${selectedSkill.icon} ${escapeHtml(e.u.name)}</button>`).join("")}</div>`;
  }
  return skillBar+targets;
}
function ddSelectSkill(key){
  if(!ddCombatState) return;
  ddCombatState.selectedSkill=key;
  ddRender();
}
async function ddAnimateAttack(attackerSide,attackerIdx,targetSide,targetIdx,result){
  const state=ddCombatState;
  const attacker=attackerSide==="allies"?state.allies[attackerIdx]:state.enemies[attackerIdx];
  const target=targetSide==="allies"?state.allies[targetIdx]:state.enemies[targetIdx];
  // Highlight active + target
  state.allies.concat(state.enemies).forEach(u=>{u._active=false;u._targeted=false;u._lunge=false;u._struck=false;u._pop=null;});
  attacker._active=true;
  target._targeted=true;
  ddRender();
  await ddSleep(280);
  // Lunge
  attacker._lunge=true;
  ddRender();
  await ddSleep(220);
  // Apply hit
  attacker._lunge=false;
  if(!result.isMiss){
    target._struck=true;
    target._pop={text:"-"+result.damage,kind:result.isCrit?"crit":""};
    target.hp=Math.max(0,target.hp-result.damage);
  }else{
    target._pop={text:"промах",kind:"miss"};
  }
  ddRender();
  await ddSleep(700);
  target._struck=false;
  target._targeted=false;
  attacker._active=false;
  target._pop=null;
  ddRender();
}
function ddAddProse(html){
  ddCombatState.prose.push(html);
  if(ddCombatState.prose.length>60) ddCombatState.prose=ddCombatState.prose.slice(-60);
}
function ddAIPickSkill(actor,state){
  const skills=ddAvailableSkills(actor);
  // Prefer heal if low ally
  const lowAlly=state.allies.find(u=>u.hp>0 && u.hp<u.maxHp*0.4);
  if(lowAlly && skills.find(s=>s.key==="heal") && Math.random()<0.7) return skills.find(s=>s.key==="heal");
  // Prefer berserk if 2+ enemies alive
  const liveEnemies=state.enemies.filter(u=>u.hp>0).length;
  if(liveEnemies>=2 && skills.find(s=>s.key==="berserk") && Math.random()<0.5) return skills.find(s=>s.key==="berserk");
  // Prefer cleave for strong combatants
  if(skills.find(s=>s.key==="cleave") && Math.random()<0.4) return skills.find(s=>s.key==="cleave");
  // Prefer precise for marksmen
  if(skills.find(s=>s.key==="precise") && Math.random()<0.45) return skills.find(s=>s.key==="precise");
  return skills.find(s=>s.key==="strike");
}
async function ddExecuteSkill(skill,actorSide,actorIdx,state){
  const actor=actorSide==="allies"?state.allies[actorIdx]:state.enemies[actorIdx];
  // Decrement defense debuff at start of turn
  if(actor._defenseDebuff) actor._defenseDebuff=Math.max(0,actor._defenseDebuff-1);
  // Panic check
  if(actorSide==="allies" && ddPanicCheck(actor)){
    {
      const nm=escapeHtml(profileName(actor.person));
      ddAddProse(tr(
        `<span class="prose-actor">${nm}</span> <span class="prose-fall">панікує</span> і пропускає хід, тремтячи від страху.`,
        `<span class="prose-actor">${nm}</span> is <span class="prose-fall">overcome with panic</span>, trembling, and loses the turn.`
      ));
    }
    return;
  }
  let targets;
  if(skill.pickTarget){
    const idx=skill.pickTarget(state);
    if(idx<0){
      // fallback strike
      const fIdx=ddPickAllyTarget(state);
      if(fIdx<0) return;
      targets=[state.enemies[fIdx]];
    }else{
      targets=skill.targetSide==="allies"?[state.allies[idx]]:[state.enemies[idx]];
    }
  }else{
    const idx=skill.targetSide==="allies"?ddPickEnemyTarget(state):ddPickAllyTarget(state);
    if(idx<0) return;
    targets=skill.targetSide==="allies"?[state.allies[idx]]:[state.enemies[idx]];
  }
  const outcomes=skill.execute(actor,targets,state);
  for(const outcome of outcomes){
    const targetIdx=outcome.targetSide==="allies"?state.allies.indexOf(outcome.target):state.enemies.indexOf(outcome.target);
    if(outcome.result.isHeal){
      // Heal: skill.execute already restored HP, just animate
      state.allies.concat(state.enemies).forEach(u=>{u._active=false;u._targeted=false;u._lunge=false;u._struck=false;u._pop=null;});
      actor._active=true;outcome.target._targeted=true;outcome.target._pop={text:"+"+outcome.result.heal,kind:""};
      ddRender();await ddSleep(900);
      outcome.target._pop=null;outcome.target._targeted=false;actor._active=false;
      ddAddProse(`<span class="prose-actor">${escapeHtml(profileName(actor.person))}</span> накладає пов'язку на <span class="prose-actor">${escapeHtml(profileName(outcome.target.person))}</span>, повертаючи <span style="color:#5ebd72">+${outcome.result.heal}</span> HP.`);
    }else{
      await ddAnimateAttack(actorSide,actorIdx,outcome.targetSide,targetIdx,outcome.result);
      if(!outcome.result.isMiss && outcome.targetSide==="allies"){
        ddApplyStress(outcome.target,outcome.result.isCrit?15:8);
      }
      const isKill=!outcome.result.isMiss && outcome.target.hp<=0;
      const skillPrefix=skill.key!=="strike"?`<b style="color:#ffd06a">[${skill.icon} ${skill.name}]</b> `:"";
      ddAddProse(skillPrefix+ddActionProse(actor,outcome.target,outcome.result.damage,outcome.result.isCrit,outcome.result.isMiss,isKill,actorSide));
      state.rawRounds.push((actorSide==="allies"?profileName(actor.person):actor.name)+" "+skill.name+" → "+(outcome.targetSide==="allies"?profileName(outcome.target.person):outcome.target.name)+": "+(outcome.result.isMiss?"промах":outcome.result.damage));
    }
    ddRender();
    await ddSleep(350);
  }
}
async function ddRunAutoCombat(){
  const state=ddCombatState;
  ddAddProse(ddOpeningProse(state.pool,state.enemies));
  ddRender();
  await ddSleep(900);
  let safetyRounds=0;
  while(state.allies.some(u=>u.hp>0) && state.enemies.some(u=>u.hp>0) && safetyRounds<16){
    safetyRounds++;
    state.round=safetyRounds;
    for(let t=0;t<state.turnOrder.length;t++){
      state.turnPos=t;
      const turn=state.turnOrder[t];
      const actor=turn.side==="allies"?state.allies[turn.index]:state.enemies[turn.index];
      // v0.43 fix: skip dead actors (defense-in-depth) and re-check end-of-combat
      if(!actor||actor.hp<=0) continue;
      if(state.allies.every(u=>u.hp<=0) || state.enemies.every(u=>u.hp<=0)) break;
      if(turn.side==="allies"){
        const skill=ddAIPickSkill(actor,state);
        await ddExecuteSkill(skill,"allies",turn.index,state);
      }else{
        const targetIdx=ddPickEnemyTarget(state);
        if(targetIdx<0) break;
        const target=state.allies[targetIdx];
        const result=ddComputeEnemyDamage(actor,target);
        await ddAnimateAttack(turn.side,turn.index,"allies",targetIdx,result);
        if(!result.isMiss){
          ddApplyStress(target,result.isCrit?15:8);
        }
        const isKill=!result.isMiss && target.hp<=0;
        ddAddProse(ddActionProse(actor,target,result.damage,result.isCrit,result.isMiss,isKill,turn.side));
        state.rawRounds.push(actor.name+" → "+profileName(target.person)+": "+(result.isMiss?"промах":result.damage));
      }
      ddRender();
      await ddSleep(450);
      if(state.allies.every(u=>u.hp<=0) || state.enemies.every(u=>u.hp<=0)) break;
    }
  }
  const victory=state.enemies.every(u=>u.hp<=0);
  ddAddProse(`<em>${pickProse(victory?DD_PROSE.victory:DD_PROSE.defeat)}</em>`);
  state.finished=true;
  state.turnPos=-1;
  ddRender();
  ddSkipAnim=false;
  applyCombatOutcome(state.origin,state.destination,state.companionIds,state.pool,state.allies,state.enemies,state.rawRounds,state.isRaid,victory,false,state.prose);
}
function ddManualDefend(){
  const state=ddCombatState;
  if(!state||!state.awaitingPlayer) return;
  state.awaitingPlayer=false;
  ddAddProse(`<span class="prose-actor">${escapeHtml(profileName(state.allies[state.turnOrder[state.turnPos].index].person))}</span> підіймає щит і завмирає в обороні.`);
  ddRender();
  setTimeout(()=>ddAdvanceManual(),500);
}
async function ddManualUseSkill(skillKey,targetIdx,targetSide){
  const state=ddCombatState;
  if(!state||!state.awaitingPlayer) return;
  state.awaitingPlayer=false;
  const turn=state.turnOrder[state.turnPos];
  const actor=state.allies[turn.index];
  const skill=DD_SKILLS.find(s=>s.key===skillKey);
  if(!actor||!skill){state.awaitingPlayer=true;return;}
  // v0.43 fix: dead actor can't act
  if(actor.hp<=0){return ddAdvanceManual();}
  // Override execute targets - use the user's pick
  const targets=targetSide==="allies"?[state.allies[targetIdx]]:[state.enemies[targetIdx]];
  if(!targets[0]||targets[0].hp<=0){state.awaitingPlayer=true;return;}
  // Apply panic check
  if(ddPanicCheck(actor)){
    {
      const nm=escapeHtml(profileName(actor.person));
      ddAddProse(tr(
        `<span class="prose-actor">${nm}</span> <span class="prose-fall">панікує</span> і пропускає хід.`,
        `<span class="prose-actor">${nm}</span> is <span class="prose-fall">seized by panic</span> and skips the turn.`
      ));
    }
  }else{
    if(actor._defenseDebuff) actor._defenseDebuff=Math.max(0,actor._defenseDebuff-1);
    const outcomes=skill.execute(actor,targets,state);
    for(const outcome of outcomes){
      const tIdx=outcome.targetSide==="allies"?state.allies.indexOf(outcome.target):state.enemies.indexOf(outcome.target);
      if(outcome.result.isHeal){
        state.allies.concat(state.enemies).forEach(u=>{u._active=false;u._targeted=false;u._lunge=false;u._struck=false;u._pop=null;});
        actor._active=true;outcome.target._targeted=true;outcome.target._pop={text:"+"+outcome.result.heal,kind:""};
        ddRender();await ddSleep(900);
        outcome.target._pop=null;outcome.target._targeted=false;actor._active=false;
        {
          const aN=escapeHtml(profileName(actor.person));
          const tN=escapeHtml(profileName(outcome.target.person));
          const h=outcome.result.heal;
          ddAddProse(tr(
            `<span class="prose-actor">${aN}</span> накладає пов'язку на <span class="prose-actor">${tN}</span>, повертаючи <span style="color:#5ebd72">+${h}</span> HP.`,
            `<span class="prose-actor">${aN}</span> binds the wounds of <span class="prose-actor">${tN}</span>, restoring <span style="color:#5ebd72">+${h}</span> HP.`
          ));
        }
      }else{
        await ddAnimateAttack("allies",turn.index,outcome.targetSide,tIdx,outcome.result);
        const isKill=!outcome.result.isMiss && outcome.target.hp<=0;
        const skillPrefix=skill.key!=="strike"?`<b style="color:#ffd06a">[${skill.icon} ${skill.name}]</b> `:"";
        ddAddProse(skillPrefix+ddActionProse(actor,outcome.target,outcome.result.damage,outcome.result.isCrit,outcome.result.isMiss,isKill,"allies"));
        state.rawRounds.push(profileName(actor.person)+" "+skill.name+" → "+(outcome.targetSide==="allies"?profileName(outcome.target.person):outcome.target.name)+": "+(outcome.result.isMiss?"промах":outcome.result.damage));
      }
      ddRender();
      await ddSleep(350);
    }
  }
  ddAdvanceManual();
}
// Legacy fallback - if old saves call ddManualAttack
async function ddManualAttack(enemyIdx){return ddManualUseSkill("strike",enemyIdx,"enemies");}
async function ddAdvanceManual(){
  const state=ddCombatState;
  if(!state) return;
  // End-of-combat check first
  if(state.enemies.every(u=>u.hp<=0) || state.allies.every(u=>u.hp<=0)) return ddFinishManual();
  // Advance turnPos to next ALIVE unit, wrapping around if needed.
  // Use a hard cap to avoid infinite loops if somehow all units are dead.
  const maxSteps=state.turnOrder.length*3+2;
  let steps=0;
  state.turnPos++;
  while(steps<maxSteps){
    if(state.turnPos>=state.turnOrder.length){
      state.turnPos=0;
      state.round++;
    }
    const turn=state.turnOrder[state.turnPos];
    if(turn){
      const u=turn.side==="allies"?state.allies[turn.index]:state.enemies[turn.index];
      if(u && u.hp>0) break;
    }
    state.turnPos++;
    steps++;
  }
  if(steps>=maxSteps) return ddFinishManual();
  const turn=state.turnOrder[state.turnPos];
  if(!turn) return ddFinishManual();
  if(turn.side==="allies"){
    state.awaitingPlayer=true;
    ddRender();
    return;
  }
  // Enemy turn (auto)
  const enemy=state.enemies[turn.index];
  if(!enemy || enemy.hp<=0) {return ddAdvanceManual();}
  const allyIdx=ddPickEnemyTarget(state);
  if(allyIdx<0) return ddFinishManual();
  const ally=state.allies[allyIdx];
  if(!ally || ally.hp<=0) return ddAdvanceManual();
  const result=ddComputeEnemyDamage(enemy,ally);
  await ddAnimateAttack("enemies",turn.index,"allies",allyIdx,result);
  if(!result.isMiss){
    ddApplyStress(ally,result.isCrit?15:8);
  }
  const isKill=!result.isMiss && ally.hp<=0;
  ddAddProse(ddActionProse(enemy,ally,result.damage,result.isCrit,result.isMiss,isKill,"enemies"));
  state.rawRounds.push(enemy.name+" → "+profileName(ally.person)+": "+(result.isMiss?"промах":result.damage));
  ddRender();
  // End-of-combat check before recursing
  if(state.enemies.every(u=>u.hp<=0) || state.allies.every(u=>u.hp<=0)) return ddFinishManual();
  setTimeout(()=>ddAdvanceManual(),300);
}
function ddFinishManual(){
  const state=ddCombatState;
  const victory=state.enemies.every(u=>u.hp<=0);
  ddAddProse(`<em>${pickProse(victory?DD_PROSE.victory:DD_PROSE.defeat)}</em>`);
  state.finished=true;
  state.turnPos=-1;
  ddRender();
  applyCombatOutcome(state.origin,state.destination,state.companionIds,state.pool,state.allies,state.enemies,state.rawRounds,state.isRaid,victory,true,state.prose);
}

function combatArenaHtml(allies,enemies){
  const hero=`<div class="combat-unit hero-unit"><img src="assets/player/${player.portrait||"yakiv"}_portrait.png" onerror="this.style.display='none'"><b>${escapeHtml(player.name||"Герой")}</b><span>торговець</span></div>`;
  const allyCards=allies.map(unit=>{
    const wIdx=getWomenPanelIndex(unit.person);
    const pm=wIdx>=0?`<div class="women-panel-portrait" style="background-position-x:${(wIdx/(WOMEN_PANEL_SETS.length-1))*100}%"></div>`:`<img src="${portraitPaths(unit.person)[0]}" onerror="this.style.display='none'">`;
    return `<div class="combat-unit ${unit.hp<=0?"fallen":""}">${pm}<b>${htmlName(unit.person)}</b>${healthBar(unit.hp,unit.maxHp)}<span>HP ${Math.max(0,unit.hp)} • Бій ${unit.person.combat} • Сила ${unit.person.strength}</span></div>`;
  }).join("");
  const enemyCards=enemies.map(enemy=>`<div class="combat-unit enemy-unit ${enemy.hp<=0?"fallen":""}"><b>${escapeHtml(enemy.name)}</b>${healthBar(enemy.hp,enemy.maxHp)}<span>HP ${Math.max(0,enemy.hp)} • Атака ${enemy.attack} • Захист ${enemy.defense}</span></div>`).join("");
  return `<div class="combat-arena"><div class="combat-side allies">${hero}${allyCards}</div><div class="battlefield">⚔️<span>поле бою</span></div><div class="combat-side enemies">${enemyCards}</div></div>`;
}
function healthBar(hp,maxHp){
  const pct=clamp(Math.round((Math.max(0,hp)/Math.max(1,maxHp))*100),0,100);
  return `<div class="hp-bar"><span style="width:${pct}%"></span></div>`;
}
function manualCombatArenaHtml(state){
  const allyCards=state.allies.map((unit,index)=>{
    const wIdx=getWomenPanelIndex(unit.person);
    const pm=wIdx>=0?`<div class="women-panel-portrait" style="background-position-x:${(wIdx/(WOMEN_PANEL_SETS.length-1))*100}%"></div>`:`<img src="${portraitPaths(unit.person)[0]}" onerror="this.style.display='none'">`;
    return `<button class="combat-unit manual-unit ${state.selectedAlly===index?"selected":""} ${unit.hp<=0?"fallen":""}" ${unit.hp<=0?"disabled":""} onclick="selectManualAlly(${index})">${pm}<b>${htmlName(unit.person)}</b>${healthBar(unit.hp,unit.maxHp)}<span>HP ${Math.max(0,unit.hp)} • Бій ${unit.person.combat} • Сила ${unit.person.strength}</span></button>`;
  }).join("");
  const enemyCards=state.enemies.map((enemy,index)=>`<button class="combat-unit manual-unit enemy-unit ${enemy.hp<=0?"fallen":""}" ${enemy.hp<=0?"disabled":""} onclick="manualAttack(${index})"><b>${escapeHtml(enemy.name)}</b>${healthBar(enemy.hp,enemy.maxHp)}<span>HP ${Math.max(0,enemy.hp)} • Атака ${enemy.attack} • Захист ${enemy.defense}</span></button>`).join("");
  const hero=`<div class="combat-unit hero-unit"><img src="assets/player/${player.portrait||"yakiv"}_portrait.png" onerror="this.style.display='none'"><b>${escapeHtml(player.name||"Герой")}</b><span>обери союзника, потім ворога</span></div>`;
  return `<div class="combat-reward-box"><h3>Ручний бій</h3><div>Раунд ${state.round}. Обраний боєць: ${state.selectedAlly===null?"немає":escapeHtml(profileName(state.allies[state.selectedAlly].person))}. Натисни свого NPC, потім ворога для удару.</div></div><div class="combat-arena manual-arena"><div class="combat-side allies">${hero}${allyCards}</div><div class="battlefield">⚔️<span>ручний режим</span></div><div class="combat-side enemies">${enemyCards}</div></div>`;
}
function showCombatReport(title,text,rounds,arenaHtml="",rewardHtml="",prose=null){
  document.getElementById("combatTitle").innerText=title;
  document.getElementById("combatText").innerText=text;
  const arena=document.getElementById("combatArena");
  // Preserve DD arena if currently in DD combat - just inject reward box at top
  if(arena){
    if(ddCombatState && ddCombatState.finished){
      arena.innerHTML=rewardHtml+ddArenaHtml(ddCombatState);
    }else{
      arena.innerHTML=rewardHtml+arenaHtml;
    }
  }
  const rounds_el=document.getElementById("combatRounds");
  if(prose && prose.length){
    rounds_el.innerHTML=`<div class="dd-narration">${prose.map(p=>`<p>${p}</p>`).join("")}</div>`;
    const nar=rounds_el.querySelector(".dd-narration");
    if(nar) nar.scrollTop=nar.scrollHeight;
  }else{
    rounds_el.innerHTML=rounds.map(line=>`<div class="log-entry log-danger">${escapeHtml(line)}</div>`).join("");
  }
  const closeButton=document.getElementById("combatCloseButton");
  if(closeButton){closeButton.disabled=false;closeButton.innerText="Продовжити";}
  if(rounds.length) log("⚔️ Журнал бою: "+rounds.slice(0,5).join(" | ")+(rounds.length>5?" | ...":""),"danger");
  document.getElementById("combatModal").classList.remove("hidden");
}
function closeCombat(){
  if(manualCombatState){
    renderManualCombat();
    return;
  }
  document.getElementById("combatModal").classList.add("hidden");
  _checkPendingTravelAnim();
  notifyCombatClosed();
}
function renderManualCombat(){
  if(!manualCombatState) return;
  document.getElementById("combatTitle").innerText=manualCombatState.title;
  document.getElementById("combatText").innerText=tr("Ручний режим: обирай союзника і ціль. Після твого удару вороги відповідають.","Manual mode: pick an ally and a target. After your blow the enemies respond.");
  document.getElementById("combatArena").innerHTML=manualCombatArenaHtml(manualCombatState);
  document.getElementById("combatRounds").innerHTML=manualCombatState.rounds.slice(-18).map(line=>`<div class="log-entry log-danger">${escapeHtml(line)}</div>`).join("");
  const closeButton=document.getElementById("combatCloseButton");
  if(closeButton){closeButton.disabled=true;closeButton.innerText=tr("Завершіть бій","Finish the fight");}
  document.getElementById("combatModal").classList.remove("hidden");
}
function selectManualAlly(index){
  if(!manualCombatState || !manualCombatState.allies[index] || manualCombatState.allies[index].hp<=0) return;
  manualCombatState.selectedAlly=index;
  renderManualCombat();
}
function manualEnemiesTurn(){
  const state=manualCombatState;
  state.enemies.filter(enemy=>enemy.hp>0).forEach(enemy=>{
    const target=state.allies.filter(unit=>unit.hp>0).sort((a,b)=>a.hp-b.hp)[0];
    if(!target) return;
    const damage=Math.max(1,enemy.attack-rand(0,Math.floor(target.person.combat/4)));
    target.hp-=damage;
    state.rounds.push(`${state.round}. ${enemy.name} ранить ${profileName(target.person)} на ${damage}.`);
  });
}
function manualAttack(enemyIndex){
  const state=manualCombatState;
  if(!state || state.selectedAlly===null) return;
  const ally=state.allies[state.selectedAlly];
  const enemy=state.enemies[enemyIndex];
  if(!ally || !enemy || ally.hp<=0 || enemy.hp<=0) return;
  const damage=Math.max(1,rand(1,4)+Math.floor(ally.person.combat/3)+Math.floor(ally.person.strength/4)-enemy.defense);
  enemy.hp-=damage;
  state.rounds.push(`${state.round}. ${profileName(ally.person)} завдає ${damage} шкоди: ${enemy.name}.`);
  if(state.enemies.every(unit=>unit.hp<=0)) return finishManualCombat(true);
  manualEnemiesTurn();
  if(state.allies.every(unit=>unit.hp<=0)) return finishManualCombat(false);
  state.round++;
  const next=state.allies.findIndex(unit=>unit.hp>0);
  state.selectedAlly=next>=0?next:null;
  renderManualCombat();
}
function finishManualCombat(victory){
  const state=manualCombatState;
  if(!state) return;
  manualCombatState=null;
  applyCombatOutcome(state.origin,state.destination,state.companionIds,state.pool,state.allies,state.enemies,state.rounds,state.isRaid,victory,true);
  saveGame(false);
  render();
}
function loseTravelCargo(allCargo){
  const goods=Object.keys(inventory).filter(name=>validGoods().has(name) && inventory[name]>0);
  if(!goods.length) return "товару не було";
  const lost=[];
  goods.forEach(name=>{
    const owned=inventoryCount(name);
    const qty=allCargo?owned:Math.max(1,Math.ceil(owned*(0.35+Math.random()*0.3)));
    removeItem(name,qty);
    lost.push(qty+" × "+name);
  });
  return lost.join(", ");
}
function tryCaptureDefeatedEnemy(origin,destination,companionIds){
  if(!Array.isArray(companionIds) || companionIds.length>=4 || Math.random()>=0.2) return "";
  const captured=makeNPC("slave",origin,{gender:pick(["male","female"]),locationCity:origin,city:origin,homeCity:"полонений на шляху "+cities[origin].name+" → "+cities[destination].name,story:"Після програної сутички ця людина потрапила до рук торгового дому",hope:"вижити й знайти нове місце в чужому дворі"});
  ownedSlaves.push(captured);
  companionIds.push(captured.id);
  return " "+tr("Захоплено полоненого: ","Captured prisoner: ")+profileName(captured)+".";
}
function combatRewardBox(lines,manual=false){
  const content=lines.filter(Boolean).map(line=>`<div>${escapeHtml(line)}</div>`).join("");
  const mode=manual?`<div class="combat-mode-note">${tr("Ручний режим поки працює як збільшена тактична сцена з повним журналом. Наступний крок - кліки по NPC і цілі.","Manual mode currently renders an enlarged tactical scene with a full log. Next step: clicks on NPC and target.")}</div>`:"";
  return `<div class="combat-reward-box"><h3>${tr("Підсумок бою","Battle summary")}</h3>${content}${mode}</div>`;
}
function applyCombatOutcome(origin,destination,companionIds,pool,allies,enemies,rounds,isRaid,victory,manual=false,prose=null){
  // v0.43: reset stress on victory, half on defeat
  allies.forEach(unit=>{
    if(unit.person) unit.person.combatStress=victory?0:Math.floor((unit.stress||0)/2);
  });
  const difficulty=clamp(Math.ceil(travelDaysBetween(origin,destination)/2),1,4);
  const fallen=[];
  allies.forEach(unit=>{
    const healthLoss=unit.hp<=0?unit.person.health:Math.max(0,Math.ceil((unit.person.health+unit.person.strength)-unit.hp)/4);
    unit.person.health=clamp(unit.person.health-healthLoss,0,BALANCE.maxAttribute);
    if(unit.person.health<=0 || unit.hp<=0){
      if((player.lifeElixirs||0)>0){
        player.lifeElixirs--;
        unit.person.health=6;
        unit.hp=6;
        log("🧪 Еліксир життя врятував "+profileName(unit.person)+" від смерті. Залишилось еліксирів: "+player.lifeElixirs+".","danger");
      }else{
        fallen.push(unit.person);
        log("☠️ "+profileName(unit.person)+" загинув у бою. Це остаточна втрата для торгового дому.","danger");
        removeKilledNpc(unit.person);
      }
    }else{
      unit.person.combat=clamp(unit.person.combat+1,0,BALANCE.maxAttribute);
      unit.person.loyalty=clamp(unit.person.loyalty+(victory?1:0),0,BALANCE.maxAttribute);
    }
  });
  if(victory){
    const money=rand(isRaid?45:22,isRaid?105:55)+difficulty*(isRaid?18:12);
    const foodReward=pool.loot.includes("Їжа")?rand(1,4):0;
    const good=pick(pool.loot.filter(name=>name!=="Монети"&&name!=="Їжа"));
    const goodQty=good?rand(isRaid?2:1,isRaid?4:2):0;
    gold+=money;
    if(foodReward) food+=foodReward;
    if(good) addItem(good,goodQty);
    const combatLoot=Math.random()<0.35?pick(["iron_sword","iron_armor"]):null;
    if(combatLoot) itemInventory[combatLoot]=itemStock(combatLoot)+1;
    if(isRaid){
      adjustReputation(-4,destination);
      const capture=tryCaptureDefeatedEnemy(origin,destination,companionIds);
      log("⚔️ "+tr("Напад на караван міста ","Caravan raid in ")+cityName(destination)+tr(" вдався. Здобуто "," succeeded. Earned ")+money+tr(" монет"," coins")+(good?(tr(", товар: ",", goods: ")+goodName(good)+" × "+goodQty):"")+tr(". Репутація в цьому місті -4.",". Reputation in this city -4.")+capture,"danger");
      showCombatReport(tr("Перемога над караваном","Victory over the caravan"),tr("Підлеглі розбили охорону чужого обозу. Місто ","Your retainers broke the rival convoy's guards. The city of ")+cityName(destination)+tr(" запам'ятає цей напад. Загиблих серед твоїх людей: "," will remember this raid. Fallen on your side: ")+fallen.length+".",rounds,combatArenaHtml(allies,enemies),combatRewardBox([tr("Здобуто монет: +","Coins earned: +")+money,good?tr("Здобуто товар: ","Goods seized: ")+goodName(good)+" × "+goodQty:"",combatLoot?tr("Знайдено спорядження: ","Gear found: ")+itemById(combatLoot).name:"",capture.trim()||"", tr("Репутація ","Reputation ")+cityName(destination)+": -4"],manual),prose);
    }else{
      adjustReputation(1,origin);
      const capture=tryCaptureDefeatedEnemy(origin,destination,companionIds);
      log("⚔️ "+tr("Перемога в дорозі: ","Road victory: ")+poolTitle(pool)+tr(". Здобуто ",". Earned ")+money+tr(" монет"," coins")+(foodReward?(tr(", їжа +",", food +")+foodReward):"")+(good?(tr(", товар: ",", goods: ")+goodName(good)):"")+"."+capture,"travel");
      showCombatReport(tr("Перемога: ","Victory: ")+poolTitle(pool),tr("Підлеглі захистили шлях між ","Your retainers defended the road between ")+cityName(origin)+tr(" і "," and ")+cityName(destination)+tr(". Загиблих: ",". Fallen: ")+fallen.length+".",rounds,combatArenaHtml(allies,enemies),combatRewardBox([tr("Здобуто монет: +","Coins earned: +")+money,foodReward?tr("Їжа: +","Food: +")+foodReward:"",good?tr("Здобуто товар: ","Goods seized: ")+goodName(good):"",combatLoot?tr("Знайдено спорядження: ","Gear found: ")+itemById(combatLoot).name:"",capture.trim()||"", tr("Репутація ","Reputation ")+cityName(origin)+": +1"],manual),prose);
    }
  }else{
    const loss=Math.min(Math.max(0,gold),rand(30,90));
    const lostGoods=loseTravelCargo(isRaid?false:Math.random()<0.45);
    gold-=loss;
    adjustReputation(isRaid?-2:-1,isRaid?destination:origin);
    log("⚔️ "+tr("Поразка в дорозі: ","Road defeat: ")+poolTitle(pool)+tr(". Втрачено ",". Lost ")+loss+tr(" монет і товар (",  " coins and goods (")+lostGoods+tr("). Загиблих: ","). Fallen: ")+fallen.length+".","danger");
    showCombatReport(tr("Поразка: ","Defeat: ")+poolTitle(pool),tr("Загін не втримав дорогу між ","The escort failed to hold the road between ")+cityName(origin)+tr(" і "," and ")+cityName(destination)+tr(". Загиблих: ",". Fallen: ")+fallen.length+".",rounds,combatArenaHtml(allies,enemies),combatRewardBox([tr("Втрачено монет: -","Coins lost: -")+loss,tr("Втрачено товар: ","Goods lost: ")+lostGoods,tr("Загиблих: ","Fallen: ")+fallen.length],manual),prose);
  }
}
function resolveRoadCombat(origin,destination,companionIds=null,options={}){
  const isRaid=!!options.raid;
  const manual=!!options.manual;
  if(!isRaid && !options.forced && badReputationFear(origin)){
    const text=pick(roadFearEvents);
    log("🛡️ "+cities[origin].name+" → "+cities[destination].name+": "+text+" Погана репутація спрацювала як захист дороги.","travel");
    return null; // v0.43: no modal opened, nothing to await
  }
  // v0.43: build promise that resolves on closeCombat (combat modal opens in all paths below)
  const combatPromise=waitForCombatClose();
  const party=travelParty(origin,companionIds);
  if(!party.length){
    const lostGoods=loseTravelCargo(true);
    log("⚔️ "+tr("На шляху стався напад, але торговець вирушив без охорони. Опору не було: втрачено весь доступний товар (","An attack on the road, but the merchant set out without an escort. No resistance: lost all available goods (")+lostGoods+").","danger");
    showCombatReport(tr("Беззахисна подорож","Undefended journey"),tr("Без підлеглих герой не може прийняти бій. Нападники забрали товар і зникли до світанку.","Without retainers the hero cannot stand a fight. The raiders took the goods and vanished before dawn."),[tr("Підлеглих у дорозі немає.","No retainers on the road."),tr("Втрачено: ","Lost: ")+lostGoods+"."],combatArenaHtml([],[]),combatRewardBox([tr("Втрачено: ","Lost: ")+lostGoods],manual));
    return combatPromise;
  }
  const difficulty=clamp(Math.ceil(travelDaysBetween(origin,destination)/2),1,4);
  const pool=isRaid
    ? {kind:"caravan",title:"Зустрічний караван міста "+cities[destination].name,titleEn:"Rival caravan from "+cities[destination].name,names:["Охоронець каравану","Візник зі списом","Найманий меч","Старший обозу"],namesEn:["Caravan guard","Spear-driver","Hired blade","Caravan master"],loot:["Монети"].concat(cities[destination].supply||[])}
    : pick(combatEnemyPools);
  const enemies=Array.from({length:rand(1,4)},(_,index)=>makeEnemyUnit(pool,index,difficulty));
  const allies=party.map(person=>{
    const hp=Math.max(6,person.health+person.strength+Math.floor(person.combat/2));
    return {person,hp,maxHp:hp};
  });
  // mark enemy pool kind for art/prose
  enemies.forEach(e=>{e.kind=pool.kind||"bandit";});
  ddCombatState={
    title:(isRaid?tr("⚔️ Напад на караван: ","⚔️ Caravan raid: "):tr("⚔️ Сутичка на дорозі: ","⚔️ Road skirmish: "))+poolTitle(pool),
    subtitle:cityName(origin)+" → "+cityName(destination)+(manual?tr(" • Ручний режим"," • Manual mode"):""),
    origin,destination,companionIds,pool,isRaid,manual,
    allies,enemies,prose:[],rawRounds:[],
    round:1,turnPos:0,finished:false,awaitingPlayer:false
  };
  ddBuildTurnOrder(ddCombatState);
  // Open modal immediately, set animation
  document.getElementById("combatModal").classList.remove("hidden");
  document.getElementById("combatTitle").innerText=ddCombatState.title;
  document.getElementById("combatText").innerText=ddCombatState.subtitle;
  document.getElementById("combatArena").innerHTML=ddArenaHtml(ddCombatState);
  document.getElementById("combatRounds").innerHTML=`<div class="dd-narration"></div>`;
  if(manual){
    ddAddProse(ddOpeningProse(ddCombatState.pool,ddCombatState.enemies));
    // find first ally turn
    while(ddCombatState.turnPos<ddCombatState.turnOrder.length && ddCombatState.turnOrder[ddCombatState.turnPos].side!=="allies"){
      const t=ddCombatState.turnOrder[ddCombatState.turnPos];
      const e=ddCombatState.enemies[t.index];
      // skip ahead - but simpler: just start with first ally awaiting
      ddCombatState.turnPos++;
    }
    if(ddCombatState.turnPos>=ddCombatState.turnOrder.length){
      const ai=ddCombatState.turnOrder.findIndex(t=>t.side==="allies");
      // v0.43: guard against findIndex === -1 (no allies in turn order)
      ddCombatState.turnPos=ai>=0?ai:0;
    }
    if(ddCombatState.turnPos<0) ddCombatState.turnPos=0;
    ddCombatState.awaitingPlayer=true;
    ddRender();
    return combatPromise;
  }
  ddRunAutoCombat();
  return combatPromise;
}
// v0.43: split into pure roll (returns kind) + apply (logs/state) for async travel flow
function rollTravelEvent(origin,destination,companionIds=null){
  const event=pick(travelEvents);
  if((event.gold<0 || event.reputation<0) && badReputationFear(origin)){
    const text=pick(roadFearEvents);
    log("🛡️ "+cities[origin].name+" → "+cities[destination].name+": "+text+" Негативна дорожня подія не спрацювала через погану репутацію.","travel");
    return {kind:"protected"};
  }
  if((event.title.includes("Напад") || event.text.includes("напад")) && Math.random()<0.75){
    if(guardedQuestProtection() && Math.random()<0.75){
      log("🛡️ Найнята для завдання охорона помітила засідку раніше за нападників і провела загін без бою.","travel");
      return {kind:"guarded"};
    }
    return {kind:"ambush",event};
  }
  gold+=event.gold;
  adjustReputation(event.reputation,origin);
  log("🛤️ "+tr("У дорозі ","On the road ")+cityName(origin)+" → "+cityName(destination)+": "+event.title+". "+event.text+" "+tr("Гроші ","Coins ")+(event.gold>=0?"+":"")+event.gold+", "+tr("репутація ","reputation ")+cityName(origin)+" "+(event.reputation>=0?"+":"")+event.reputation+".","travel");
  return {kind:"normal",event};
}
// Legacy wrapper — keeps any old callers working (synchronous combat trigger)
function applyTravelEvent(origin,destination,companionIds=null){
  const result=rollTravelEvent(origin,destination,companionIds);
  if(result.kind==="ambush"){
    resolveRoadCombat(origin,destination,companionIds,{manual:selectedBattleMode==="manual"});
  }
}
// === v0.43 Routes ===
const ROUTE_TYPES=[
  {key:"forest",icon:"🌲",name:"Лісом",nameEn:"Forest path",daysMod:-1,costMod:0.9,ambushMod:1.6,eventMod:1.1,
    desc:"Швидше на 1 день, дешевше на 10%. Висока ймовірність засідки.",descEn:"-1 day, -10% cost, +60% ambush chance."},
  {key:"highway",icon:"🛣️",name:"Великим шляхом",nameEn:"Highway",daysMod:0,costMod:1.0,ambushMod:1.0,eventMod:1.0,
    desc:"Стандартний маршрут. Класична торгова дорога.",descEn:"Standard route. Classic trade road."},
  {key:"alt",icon:"⛰️",name:"Гірський перевал",nameEn:"Mountain pass",daysMod:1,costMod:1.2,ambushMod:0.4,eventMod:0.9,
    desc:"Повільніше на 1 день, +20% мита. Безпечно: -60% засідок.",descEn:"+1 day, +20% tolls, -60% ambushes."}
];
let selectedRoute="highway";
function getRoute(){return ROUTE_TYPES.find(r=>r.key===selectedRoute)||ROUTE_TYPES[1];}
function routeAdjustedDays(origin,destination){
  const base=Math.max(1,travelDaysBetween(origin,destination)+getRoute().daysMod);
  return base;
}
function routeAdjustedCost(destination){
  return Math.max(10,Math.round(travelCost(destination)*getRoute().costMod));
}
function selectRoute(key){
  selectedRoute=key;
  renderTravelCompanionList();
}
function routeChoiceHtml(){
  const dayLbl=tr("дн.","d");
  const stdLbl=tr("стандарт","standard");
  const ambushLbl=tr("засідок","ambushes");
  return `<div class="route-choice-grid">${ROUTE_TYPES.map(r=>`
    <button class="route-choice ${selectedRoute===r.key?"selected":""}" data-route="${r.key}" onclick="selectRoute('${r.key}')">
      <div class="route-art"></div>
      <div class="route-info">
        <div class="route-icon">${r.icon}</div>
        <div class="route-name">${lang==="en"?r.nameEn:r.name}</div>
        <div class="route-stats">
          <span class="route-stat">⏱️ ${r.daysMod>0?"+":""}${r.daysMod} ${dayLbl}</span>
          <span class="route-stat">💰 ${r.costMod===1?stdLbl:Math.round((r.costMod-1)*100)+"%"}</span>
          <span class="route-stat">⚔️ ${r.ambushMod===1?stdLbl:(r.ambushMod>1?"+":"-")+Math.round(Math.abs(r.ambushMod-1)*100)+"% "+ambushLbl}</span>
        </div>
        <div class="route-stats" style="font-style:italic">${escapeHtml(lang==="en"?r.descEn:r.desc)}</div>
      </div>
    </button>`).join("")}</div>`;
}

function prepareTravel(destination){
  if(destination===currentCity) return;
  selectedTravelDestination=destination;
  selectedTravelCompanions=requiredTravelCompanionIds(currentCity);
  selectedRoute="highway";
  renderTravelMap();
  renderTravelCompanionList();
  document.getElementById("travelModal").classList.remove("hidden");
}
function closeTravelModal(){
  document.getElementById("travelModal").classList.add("hidden");
  selectedTravelDestination=null;
  selectedTravelCompanions=[];
  renderTravelMap();
}
function currentBattleMode(){
  const selected=document.querySelector&&document.querySelector('input[name="battleMode"]:checked');
  return selected&&selected.value==="manual"?"manual":"auto";
}
function toggleTravelCompanion(id){
  id=Number(id);
  if(selectedTravelCompanions.includes(id)){
    if(requiredTravelCompanionIds(currentCity).includes(id)){
      log("ℹ️ Цей NPC уже в дорожньому загоні й не може залишитися у чужому місті без героя.","travel");
      renderLog();
      return;
    }
    selectedTravelCompanions=selectedTravelCompanions.filter(value=>value!==id);
  }else if(selectedTravelCompanions.length<4){
    selectedTravelCompanions.push(id);
  }else{
    log("❌ У дорожній загін можна взяти максимум 4 NPC.","travel");
  }
  renderTravelCompanionList();
  renderLog();
}
function renderTravelCompanionList(){
  const destination=selectedTravelDestination;
  if(destination===null) return;
  const companions=eligibleTravelCompanions(currentCity);
  const chosen=travelParty(currentCity,selectedTravelCompanions);
  const required=new Set(requiredTravelCompanionIds(currentCity));
  const cost=travelCost(destination);
  const days=travelDaysBetween(currentCity,destination);
  const adjDays=routeAdjustedDays(currentCity,destination);
  const adjCost=routeAdjustedCost(destination);
  document.getElementById("travelModalTitle").innerText=tr("Подорож до міста ","Travel to ")+cityName(destination);
  document.getElementById("travelModalText").innerHTML=tr(
    `Дорога з <b>${cityName(currentCity)}</b> з обраним маршрутом триватиме <b>${adjDays} дн.</b> і коштуватиме <b>${adjCost} монет</b>.<br>${routeChoiceHtml()}Обери до 4 вільних підлеглих, які поїдуть разом з героєм та зможуть захистити його у бою.`,
    `The journey from <b>${cityName(currentCity)}</b> on the chosen route will take <b>${adjDays} d.</b> and cost <b>${adjCost} coins</b>.<br>${routeChoiceHtml()}Pick up to 4 free retainers to escort the hero and defend him in combat.`
  );
  const list=companions.length?companions.map(person=>{
    const selected=selectedTravelCompanions.includes(person.id);
    return `<button class="companion-choice ${selected?"selected":""}" onclick="toggleTravelCompanion(${person.id})"><b>${htmlName(person)}</b><br><span class="badge">${statusLabel(person)}</span>${required.has(person.id)?`<span class="badge relation-rank">Їде з героєм</span>`:""}<span class="badge">Бій ${person.combat}</span><span class="badge">Сила ${person.strength}</span><span class="badge">Здоров'я ${person.health}</span><br><span class="muted">Сила загону: ${travelCompanionPower(person)}</span></button>`;
  }).join(""):`<div class="empty">У цьому місті немає вільних дорослих NPC. Найми когось у Центрі зайнятості або звільни підлеглого від роботи перед дорогою.</div>`;
  const raidDisabled=chosen.length<1;
  document.getElementById("travelCompanionList").innerHTML=`<div class="travel-risk-note"><b>Обрано супровід:</b> ${chosen.length} / 4. ${chosen.length?"Можна приймати бій або напасти на чужий караван.":"Без супроводу нападати не можна; якщо на героя нападуть, він автоматично втратить товар."}</div><div class="travel-party-grid">${list}</div>`;
  const raidButton=document.getElementById("raidCaravanButton");
  raidButton.disabled=raidDisabled;
  raidButton.innerText=raidDisabled?"Напад недоступний без NPC":"Напасти на зустрічний караван";
}
function moveTravelCompanions(companionIds,destination){
  const moved=travelParty(currentCity,companionIds);
  const destCityName=cities[destination]&&cities[destination].name;
  moved.forEach(person=>{
    person.locationCity=destination;
    // v0.43 #2: Mark aspiration flags for travel-based archetypes
    person.aspirationFlags=person.aspirationFlags||{};
    const data=getAspirationData(person);
    if(data){
      if(data.targetCityName && destCityName===data.targetCityName) person.aspirationFlags.visitedTarget=true;
      if(destCityName===person.homeCity) person.aspirationFlags.visitedHome=true;
    }
  });
  travelCompanionIds=hasHeadquarters() && destination===player.headquartersCity?[]:moved.map(person=>person.id).slice(0,4);
}
let _travelAnimCallback=null;
let _pendingTravelAnim=null;
let _travelSkipRequested=false;
let _travelAnimRoute=null;
function _checkPendingTravelAnim(){
  if(!_pendingTravelAnim) return;
  const anyModalOpen=[...document.querySelectorAll('.modal')].some(m=>!m.classList.contains('hidden'));
  if(anyModalOpen) return;
  const p=_pendingTravelAnim;
  _pendingTravelAnim=null;
  showTravelAnimation(p.origin,p.destination,p.duration,p.journalSnapshot,p.onDone);
}
function skipTravelAnim(){
  if(_travelAnimCallback){
    clearInterval(_travelAnimCallback);
    _travelAnimCallback=null;
  }
  _travelSkipRequested=true;
  document.getElementById("travelAnimOverlay").classList.add("hidden");
  _pendingTravelAnim=null;
}
// === v0.43: incremental travel overlay for async confirmTravel ===
function beginTravelOverlay(origin,destination,duration){
  _travelSkipRequested=false;
  _travelAnimRoute={origin,destination};
  _travelAnimProgressFrom=0;
  if(_travelAnimRAF){cancelAnimationFrame(_travelAnimRAF);_travelAnimRAF=null;}
  const overlay=document.getElementById("travelAnimOverlay");
  const artKey=k=>cityArtKeys[k]||"";
  document.getElementById("travelAnimFromImg").src="assets/cities/"+artKey(origin)+".png";
  document.getElementById("travelAnimToImg").src="assets/cities/"+artKey(destination)+".png";
  document.getElementById("travelAnimFromName").textContent=cityName(origin);
  document.getElementById("travelAnimToName").textContent=cityName(destination);
  document.getElementById("travelAnimDayCounter").textContent=tr("День 0 / ","Day 0 / ")+duration;
  document.getElementById("travelAnimProgressFill").style.width="0%";
  document.getElementById("travelAnimWagon").style.left="0%";
  document.getElementById("travelAnimEvents").innerHTML="";
  renderTravelAnimMap(origin,destination,0);
  overlay.classList.remove("hidden");
  // Hook skip button to set flag (so async loop can break out fast)
  overlay.querySelector(".travel-anim-skip").onclick=()=>{_travelSkipRequested=true;};
}
function setTravelDay(day,duration){
  const counter=document.getElementById("travelAnimDayCounter");
  const progress=Math.max(0,Math.min(1,day/duration));
  counter.textContent=(tr("День ","Day "))+day+" / "+duration;
  // v0.43: smooth wagon movement on map instead of teleport
  smoothTravelProgress(progress, _travelSkipRequested?0:900);
}
function addTravelOverlayEvent(text,type){
  const eventBox=document.getElementById("travelAnimEvents");
  const div=document.createElement("div");
  div.className="travel-anim-event log-"+(type||"system");
  div.textContent=text;
  eventBox.appendChild(div);
  eventBox.scrollTop=eventBox.scrollHeight;
}
function hideTravelOverlay(){
  document.getElementById("travelAnimOverlay").classList.add("hidden");
}
function showTravelOverlay(){
  if(_travelSkipRequested) return;
  document.getElementById("travelAnimOverlay").classList.remove("hidden");
}
function endTravelOverlay(destination){
  const fill=document.getElementById("travelAnimProgressFill");
  const wagon=document.getElementById("travelAnimWagon");
  const counter=document.getElementById("travelAnimDayCounter");
  fill.style.width="100%";
  wagon.style.left="calc(100% - 22px)";
  counter.textContent=tr("Прибуття! ","Arrival! ")+cityName(destination);
  if(_travelAnimRoute) renderTravelAnimMap(_travelAnimRoute.origin,_travelAnimRoute.destination,1);
}
// v0.43: wait for user to click finish button instead of auto-closing
let _travelFinishResolver=null;
function waitForTravelFinish(){
  // Hide skip button, show finish button
  const skipBtn=document.querySelector(".travel-anim-skip");
  const finishBtn=document.getElementById("travelAnimFinishBtn");
  if(skipBtn) skipBtn.classList.add("hidden");
  if(finishBtn) finishBtn.classList.remove("hidden");
  return new Promise(resolve=>{_travelFinishResolver=resolve;});
}
function finishTravelOverlay(){
  if(_travelFinishResolver){
    const r=_travelFinishResolver;
    _travelFinishResolver=null;
    r();
  }
  // Reset buttons for next time
  const skipBtn=document.querySelector(".travel-anim-skip");
  const finishBtn=document.getElementById("travelAnimFinishBtn");
  if(skipBtn) skipBtn.classList.remove("hidden");
  if(finishBtn) finishBtn.classList.add("hidden");
  hideTravelOverlay();
}
function travelSkipRequested(){return _travelSkipRequested;}
function travelSleep(ms){return new Promise(r=>setTimeout(r,_travelSkipRequested?0:ms));}
// === v0.43: combat resolution Promise ===
let _combatCloseResolver=null;
function waitForCombatClose(){
  return new Promise(resolve=>{
    if(_combatCloseResolver){
      // Chain resolvers if combat triggered while one already pending
      const prev=_combatCloseResolver;
      _combatCloseResolver=()=>{prev();resolve();};
    }else{
      _combatCloseResolver=resolve;
    }
  });
}
function notifyCombatClosed(){
  if(_combatCloseResolver){
    const r=_combatCloseResolver;
    _combatCloseResolver=null;
    r();
  }
}
function showTravelAnimation(origin,destination,duration,journalSnapshot,onDone){
  // If any modal is open, defer until it's closed
  const anyModalOpen=[...document.querySelectorAll('.modal')].some(m=>!m.classList.contains('hidden'));
  if(anyModalOpen){
    _pendingTravelAnim={origin,destination,duration,journalSnapshot,onDone};
    return;
  }
  const overlay=document.getElementById("travelAnimOverlay");
  _travelAnimRoute={origin,destination};
  const artKey=k=>cityArtKeys[k]||"";
  document.getElementById("travelAnimFromImg").src="assets/cities/"+artKey(origin)+".png";
  document.getElementById("travelAnimToImg").src="assets/cities/"+artKey(destination)+".png";
  document.getElementById("travelAnimFromName").textContent=cityName(origin);
  document.getElementById("travelAnimToName").textContent=cityName(destination);
  document.getElementById("travelAnimDayCounter").textContent=tr("День 0 / ","Day 0 / ")+duration;
  document.getElementById("travelAnimProgressFill").style.width="0%";
  document.getElementById("travelAnimWagon").style.left="0%";
  document.getElementById("travelAnimEvents").innerHTML="";
  renderTravelAnimMap(origin,destination,0);
  overlay.classList.remove("hidden");
  const eventBox=document.getElementById("travelAnimEvents");
  const fill=document.getElementById("travelAnimProgressFill");
  const wagon=document.getElementById("travelAnimWagon");
  const counter=document.getElementById("travelAnimDayCounter");
  // journalSnapshot: array of {text,type} in reverse chronological order (newest first in journal)
  // We want to show them oldest first, so reverse
  const entries=[...journalSnapshot].reverse();
  let idx=0;
  const INTERVAL=900;
  _travelAnimCallback=setInterval(()=>{
    if(idx>=entries.length){
      clearInterval(_travelAnimCallback);
      _travelAnimCallback=null;
      fill.style.width="100%";
      wagon.style.left="calc(100% - 22px)";
      counter.textContent=tr("Прибуття! ","Arrival! ")+cityName(destination);
      setTimeout(()=>{
        overlay.classList.add("hidden");
        onDone();
      },800);
      return;
    }
    const e=entries[idx];
    const progress=Math.round(((idx+1)/entries.length)*100);
    fill.style.width=progress+"%";
    wagon.style.left="calc("+progress+"% - 11px)";
    renderTravelAnimMap(origin,destination,progress/100);
    const day=Math.ceil(((idx+1)/entries.length)*duration);
    counter.textContent=tr("День ","Day ")+day+" / "+duration;
    const div=document.createElement("div");
    div.className="travel-anim-event log-"+(e.type||"system");
    div.textContent=e.text;
    eventBox.appendChild(div);
    eventBox.scrollTop=eventBox.scrollHeight;
    idx++;
  },INTERVAL);
  // Allow skip button to call onDone too
  document.getElementById("travelAnimOverlay").querySelector(".travel-anim-skip").onclick=()=>{
    clearInterval(_travelAnimCallback);
    _travelAnimCallback=null;
    overlay.classList.add("hidden");
    onDone();
  };
}
async function confirmTravel(raid){
  const destination=selectedTravelDestination;
  if(destination===null || destination===currentCity) return;
  const companions=[...new Set(requiredTravelCompanionIds(currentCity).concat(selectedTravelCompanions))].slice(0,4);
  if(raid && !companions.length){
    log("❌ Без підлеглих герой не може нападати на чужі каравани.","travel");
    renderTravelCompanionList();
    renderLog();
    return;
  }
  const route=getRoute();
  const cost=routeAdjustedCost(destination);
  if(gold<cost){
    log("❌ "+tr("Не вистачає монет на дорогу та мито: потрібно ","Not enough coins for tolls: need ")+cost+".");
    render();
    return;
  }
  if(!window.confirm(tr("Вирушити до міста ","Set off to ")+cities[destination].name+" "+route.icon+" "+route.name+tr("? Дорога коштуватиме ","? The road will cost ")+cost+tr(" монет і витратить дію."," coins and one action."))) return;
  if(!consumeAction("подорож до іншого міста")) return;
  const origin=currentCity;
  const duration=routeAdjustedDays(origin,destination);
  selectedBattleMode=currentBattleMode();
  gold-=cost;
  closeTravelModal();
  // Departure log
  logAction("🧭 "+tr("Розпочато подорож ","Journey begun ")+route.icon+" "+route.name+": "+cityName(origin)+" → "+cityName(destination)+". "+tr("Час: ","Time: ")+duration+tr(" дн., витрати: "," d., cost: ")+cost+tr(" монет. Супровід: "," coins. Escort: ")+companions.length+" NPC.","travel");
  // Begin overlay
  beginTravelOverlay(origin,destination,duration);
  setTravelDay(0,duration);
  addTravelOverlayEvent(journal[0].text,"travel");
  await travelSleep(700);
  // Raid happens immediately (before any travel days)
  if(raid){
    addTravelOverlayEvent(tr("⚔️ Загін шикується для нападу на караван...","⚔️ The escort forms up to raid the caravan..."),"danger");
    await travelSleep(600);
    hideTravelOverlay();
    const combatP=resolveRoadCombat(origin,destination,companions,{raid:true,forced:true,manual:selectedBattleMode==="manual"});
    if(combatP&&typeof combatP.then==="function") await combatP;
    showTravelOverlay();
    await travelSleep(400);
  }
  // Day-by-day loop
  for(let step=0;step<duration;step++){
    if(travelSkipRequested()){
      // User wants to skip — just simulate remaining days quickly without animation
      // Advance day silently and continue
      const ambushChance=(guardedQuestProtection()?0.04:0.18)*route.ambushMod*diffMult("ambushChanceMult");
      if(step===0||Math.random()<0.45*route.eventMod){
        const r=rollTravelEvent(origin,destination,companions);
        if(r.kind==="ambush"){
          const cP=resolveRoadCombat(origin,destination,companions,{manual:selectedBattleMode==="manual"});
          if(cP&&typeof cP.then==="function") await cP;
        }
      }
      if(Math.random()<ambushChance){
        const cP=resolveRoadCombat(origin,destination,companions,{manual:selectedBattleMode==="manual"});
        if(cP&&typeof cP.then==="function") await cP;
      }
      advanceDay(false,false);
      continue;
    }
    const dayNum=step+1;
    setTravelDay(dayNum,duration);
    addTravelOverlayEvent(tr("🌅 День ","🌅 Day ")+dayNum+" "+tr("у дорозі.","on the road."),"system");
    await travelSleep(550);
    // Travel event roll
    if(step===0||Math.random()<0.45*route.eventMod){
      const beforeJournal=journal.length;
      const result=rollTravelEvent(origin,destination,companions);
      // Show any newly-added log entries for this event
      const newOnes=journal.slice(0,journal.length-beforeJournal).reverse();
      for(const e of newOnes){
        addTravelOverlayEvent(e.text,e.type||"travel");
        await travelSleep(450);
      }
      // If ambush event, trigger combat NOW
      if(result.kind==="ambush"){
        addTravelOverlayEvent(tr("⚔️ Зненацька — напад!","⚔️ Without warning — an attack!"),"danger");
        await travelSleep(700);
        hideTravelOverlay();
        const combatP=resolveRoadCombat(origin,destination,companions,{manual:selectedBattleMode==="manual"});
        if(combatP&&typeof combatP.then==="function") await combatP;
        showTravelOverlay();
        await travelSleep(400);
      }
    }
    // Independent ambush roll
    const ambushChance=(guardedQuestProtection()?0.04:0.18)*route.ambushMod*diffMult("ambushChanceMult");
    if(Math.random()<ambushChance){
      addTravelOverlayEvent(tr("⚔️ Біля стежки промайнули постаті...","⚔️ Figures move beside the path..."),"danger");
      await travelSleep(700);
      hideTravelOverlay();
      const combatP=resolveRoadCombat(origin,destination,companions,{manual:selectedBattleMode==="manual"});
      if(combatP&&typeof combatP.then==="function") await combatP;
      showTravelOverlay();
      await travelSleep(400);
    }
    advanceDay(false,false);
    await travelSleep(400);
  }
  // Arrival
  moveTravelCompanions(companions,destination);
  currentCity=destination;
  markVisitedCity(destination);
  findLegendaryItem();
  processHiddenPlaces(origin,destination);
  log("📍 "+tr("Прибуття до міста ","Arrival in ")+cityName(currentCity)+". "+tr("Місцевий ринок і гільдія тепер доступні.","The local market and guild are now available."),"travel");
  saveGame(false);
  endTravelOverlay(destination);
  addTravelOverlayEvent("📍 "+tr("Прибуття до міста ","Arrival in ")+cityName(destination),"travel");
  // v0.43: wait for user to manually close — gives time to read the journey log
  if(!travelSkipRequested()){
    await waitForTravelFinish();
  }else{
    hideTravelOverlay();
  }
  render();
}
function travelToCity(destination){prepareTravel(destination);}
function routeMatches(route,a,b){return route && ((route[0]===a&&route[1]===b)||(route[0]===b&&route[1]===a));}
function hiddenQuestState(key){player.hiddenQuests=player.hiddenQuests||{};return player.hiddenQuests[key]||{accepted:false,completed:false};}
function hiddenQuestReady(key){
  const quest=hiddenPlaces[key]&&hiddenPlaces[key].quest;
  return quest && Object.entries(quest.need).every(([name,qty])=>inventoryCount(name)>=qty);
}
function hiddenPlaceActions(key){
  const place=hiddenPlaces[key];
  const state=hiddenQuestState(key);
  if(key==="witch"){
    const price=600;
    return `<button class="btn green" onclick="buyLifeElixir()">${tr("Купити еліксир життя за","Buy life elixir for")} 💰 ${price}</button>`;
  }
  if(state.completed) return `<span class="badge">${tr("Завдання вже виконано","Quest already completed")}</span>`;
  if(!state.accepted) return `<button class="btn green" onclick="acceptHiddenQuest('${key}')">${tr("Прийняти виклик","Accept the challenge")}</button>`;
  // v0.43: for the smiths' secret recipe, hide the need list — only reveal what player has decoded via rumours
  if(place.hideNeed){
    const need=place.quest.need;
    const heardRumors=player.rumorsHeard||{};
    const lines=Object.entries(need).map(([name,qty])=>{
      const cur=inventoryCount(name);
      const enough=cur>=qty;
      // Find rumour that points to this good
      const rumor=TAVERN_RUMORS.find(r=>r.good===name);
      const decoded=rumor && heardRumors[rumor.id];
      if(decoded){
        const cityLbl=cityName(rumor.city);
        return `<div class="quest-need-line ${enough?"done":""}">${enough?"✓":"○"} <b>${escapeHtml(goodName(name))}</b> ${cur}/${qty} <span class="muted">— ${tr("чули в ","heard in ")}${escapeHtml(cityLbl)}</span></div>`;
      }
      return `<div class="quest-need-line"><span class="muted">❓ ${tr("Невідомий складник — слухай таверни","Unknown ingredient — listen in taverns")}</span></div>`;
    }).join("");
    const ready=hiddenQuestReady(key);
    const submitBtn=ready?`<button class="btn green" onclick="completeHiddenQuest('${key}')">${tr("Передати майстру всі складники","Hand all ingredients to the master")}</button>`:"";
    return `<div class="hidden-quest-list">${lines}</div>${submitBtn}`;
  }
  // Default: visible need list (for circus, scholars)
  const need=Object.entries(place.quest.need).map(([name,qty])=>`${goodName(name)} ${inventoryCount(name)}/${qty}`).join(", ");
  return hiddenQuestReady(key)?`<button class="btn green" onclick="completeHiddenQuest('${key}')">${tr("Передати ресурси й отримати нагороду","Hand over resources and claim reward")}</button>`:`<span class="badge">${tr("Потрібно","Needed")}: ${escapeHtml(need)}</span>`;
}
function showHiddenPlace(key){
  const place=hiddenPlaces[key];
  if(!place) return;
  player.foundHiddenPlaces=player.foundHiddenPlaces||[];
  if(!player.foundHiddenPlaces.includes(key)) player.foundHiddenPlaces.push(key);
  const title=lang==="en"&&place.titleEn?place.titleEn:place.title;
  const desc=lang==="en"&&place.descEn?place.descEn:place.desc;
  const lore=lang==="en"&&place.loreEn?place.loreEn:place.lore;
  document.getElementById("hiddenPlaceTitle").innerText=title;
  // v0.43: rich text — desc as opening + lore as legend block (supports inline HTML for bold)
  const textEl=document.getElementById("hiddenPlaceText");
  textEl.innerHTML=`<p class="hidden-desc">${escapeHtml(desc)}</p>`+(lore?`<div class="hidden-lore">${lore}</div>`:"");
  const imgEl=document.getElementById("hiddenPlaceImage");
  if(imgEl){
    if(place.image){
      imgEl.style.backgroundImage="url('"+place.image+"')";
      imgEl.classList.remove("hidden");
    }else{
      imgEl.classList.add("hidden");
    }
  }
  document.getElementById("hiddenPlaceActions").innerHTML=hiddenPlaceActions(key);
  document.getElementById("hiddenPlaceModal").classList.remove("hidden");
  log("🗺️ "+tr("Знайдено приховане місце: ","Hidden place discovered: ")+title+".","travel");
}
function closeHiddenPlace(){document.getElementById("hiddenPlaceModal").classList.add("hidden");_checkPendingTravelAnim();}
function buyLifeElixir(){
  const price=600;
  if(gold<price){log("❌ Не вистачає монет на еліксир життя.","shop");renderLog();return;}
  gold-=price;
  player.lifeElixirs=(player.lifeElixirs||0)+1;
  log("🧪 Куплено еліксир життя у старої ворожки. Еліксир автоматично врятує NPC від смерті в бою.","shop");
  closeHiddenPlace();
  saveGame(false);
  render();
}
function acceptHiddenQuest(key){
  const place=hiddenPlaces[key];
  if(!place || !place.quest) return;
  player.hiddenQuests[key]={accepted:true,completed:false};
  log("📜 Прийнято приховане завдання: "+place.title+".","quest");
  showHiddenPlace(key);
  saveGame(false);
  render();
}
function completeHiddenQuest(key){
  const place=hiddenPlaces[key];
  const state=hiddenQuestState(key);
  if(!place || !place.quest || !state.accepted || state.completed || !hiddenQuestReady(key)) return;
  Object.entries(place.quest.need).forEach(([name,qty])=>removeItem(name,qty));
  place.quest.rewards.forEach(id=>itemInventory[id]=itemStock(id)+1);
  if(key==="scholars") cities.forEach((city,index)=>adjustReputation(2,index));
  player.hiddenQuests[key]={accepted:true,completed:true};
  const rewardNames=place.quest.rewards.map(id=>itemById(id).name).join(", ");
  log("🎁 "+tr("Приховане завдання виконано: ","Hidden quest completed: ")+place.title+". "+tr("Отримано: ","Received: ")+rewardNames+".","quest");
  showInteractionEvent(null,{name:tr("Приховане завдання виконано","Hidden quest completed"),scene:tr("Нагорода отримана: ","Reward received: ")+rewardNames+".",effects:{}},{});
  closeHiddenPlace();
  saveGame(false);
  render();
}
function processHiddenPlaces(origin,destination){
  if(routeMatches(hiddenPlaces.witch.route,origin,destination)) showHiddenPlace("witch");
  if(routeMatches(hiddenPlaces.smiths.route,origin,destination)) showHiddenPlace("smiths");
  if(Math.random()<hiddenPlaces.circus.chance) showHiddenPlace("circus");
  if(Math.random()<hiddenPlaces.scholars.chance) showHiddenPlace("scholars");
}

function buyItem(name,requested){
  if(["Зброя","Обладунки"].includes(name)){log("❌ "+tr("Зброю та броню не продають на звичайному ринку. Їх можна викувати або здобути в бою.","Weapons and armor are not sold at regular markets. They can be forged or won in combat."),"market");render();return;}
  const good=marketGood(currentCity,name);
  const wholesale=requested>=5;
  let bought=0;
  let spent=0;
  while(bought<requested){
    const free=warehouseCapacity()-cargoUsed();
    if(free<1 || good.stock<1) break;
    let price=purchasePrice(currentCity,name);
    if(wholesale) price=Math.max(1,Math.round(price*(1-BALANCE.bulkDiscount)));
    if(gold<price) break;
    gold-=price;
    spent+=price;
    good.stock-=1;
    addItem(name,1);
    repriceGood(good);
    bought++;
  }
  if(bought<1){
    log(tr("❌ Купівля неможлива: перевір гроші, місткість складу або запас ринку.","❌ Purchase impossible: check your money, warehouse capacity, or market stock."));
    render();
    return;
  }
  const avg=Math.round(spent/bought);
  logAction("🛒 "+tr("Куплено ","Bought ")+bought+" × "+goodName(name)+tr(" у місті "," in ")+cityName(currentCity)+tr(" за "," for ")+"💰 "+spent+" (≈"+avg+"/"+tr("шт","pc")+(wholesale?tr(", опт -25%",", wholesale -25%"):"")+").","market",true);
  trackContractPurchase(name,bought,currentCity);
  saveGame(false);
  render();
}

function sellItem(name,requested){
  if(["Зброя","Обладунки"].includes(name)){log("❌ "+tr("Бойове спорядження тепер зберігається як предмети NPC, а не як ринковий товар.","Combat gear is now stored as NPC equipment, not market goods."),"market");render();return;}
  const owned=inventoryCount(name);
  const qty=Math.min(requested,owned);
  if(qty<1){
    log("❌ На складі немає товару для продажу.");
    render();
    return;
  }
  const good=marketGood(currentCity,name);
  let sold=0;
  let income=0;
  for(let i=0;i<qty;i++){
    income+=salePrice(currentCity,name);
    removeItem(name,1);
    good.stock+=1;
    repriceGood(good);
    sold++;
  }
  gold+=income;
  const avg=Math.round(income/sold);
  logAction("💰 "+tr("Продано ","Sold ")+sold+" × "+goodName(name)+tr(" у місті "," in ")+cityName(currentCity)+tr(" за "," for ")+"💰 "+income+" (≈"+avg+"/"+tr("шт","pc")+").","market",true);
  trackGuildSale(name,sold,currentCity);
  saveGame(false);
  render();
}

function buyNPC(id){
  const index=npcMarket.findIndex(n=>n.id===id);
  if(index<0) return;
  const person=npcMarket[index];
  if(person.city!==currentCity){
    log("❌ "+profileName(person)+tr(" перебуває в іншому місті. Спершу вирушай туди."," is in another city. Travel there first."));
    render();
    return;
  }
  if(isCityLocked(currentCity)){openCityLockModal();return;}
  const price=npcPrice(person);
  if(gold<price){log(tr("❌ Недостатньо монет.","❌ Not enough coins."));render();return;}
  if(hasHeadquarters() && currentCity===player.headquartersCity && freeHouseRooms()<1){
    log("❌ У Домі торговця немає вільної кімнати для нового непрацевлаштованого NPC. Відкрийте додаткову кімнату або призначте когось на роботу.","hq");
    render();
    return;
  }
  if(!window.confirm((person.status==="slave"?tr("Купити","Buy"):tr("Найняти","Hire"))+" "+profileName(person)+tr(" за "," for ")+price+" "+tr("монет?","coins?"))) return;
  if(!consumeAction(person.status==="slave"?tr("придбання підневільного NPC","buying a bonded NPC"):tr("найм працівника","hiring a worker"))) return;
  gold-=price;
  npcMarket.splice(index,1);
  person.locationCity=currentCity;
  (person.status==="slave"?ownedSlaves:ownedHirelings).push(person);
  logAction((person.status==="slave"?tr("⛓️ Куплено підневільну людину: ","⛓️ Bought bonded person: "):tr("👥 Найнято працівника: ","👥 Hired worker: "))+profileName(person)+tr(" у місті "," in ")+cityName(currentCity)+tr(" за "," for ")+price+". "+compensationText(person)+".","people");
  showInteractionEvent(person,{name:person.status==="slave"?tr("Нова підлегла людина","New subordinate"):tr("Угода про працю","Work agreement"),scene:person.status==="slave"?tr("Людину передано під вашу владу в цьому місті. Подальші рішення визначать її ставлення і майбутній статус.","This person has been placed under your authority in this city. Future choices will shape their attitude and status."):tr("Ви обговорили платню та місце роботи. Новий працівник приєднався до торгового дому у поточному місті.","You discussed wages and duties. The new worker joined the trading house in the current city."),effects:{}},relationshipSnapshot(person));
  saveGame(false);
  render();
}
function findOwned(id,status){return (status==="slave"?ownedSlaves:ownedHirelings).find(n=>n.id===id);}
function assignNPC(id,status,job){
  const person=findOwned(id,status);
  if(!person) return;
  if(!requireHeadquartersPresence() || !requireCurrentNpc(person)) return;
  if(person.status==="child"){
    log("❌ Дитина не може працювати до досягнення повноліття.");
    render();
    return;
  }
  if(job==="Заїжджий двір" && person.status==="slave"){
    log("❌ У заїжджому дворі можуть працювати лише вільні працівники, кріпаки або громадяни.");
    render();
    return;
  }
  if(!jobIsAvailable(job)){
    log("❌ Для цього призначення спершу відкрийте відповідне приміщення штабу або відновіть кухню.","system");
    render();
    return;
  }
  if(!consumeAction("призначення NPC")) return;
  person.job=job;
  person.locationCity=player.headquartersCity;
  logAction("📌 "+profileName(person)+" призначено: "+job+". Результат роботи нараховується наприкінці дня.","people");
  showInteractionEvent(person,{name:"Нове призначення",scene:"Ви обговорили нові обов'язки та передали розпорядження. Наступний денний підсумок покаже користь цього рішення.",effects:{}},relationshipSnapshot(person));
  saveGame(false);
  render();
}
function rewardNPC(id,status){
  const person=findOwned(id,status);
  if(!person) return;
  if(!requireCurrentNpc(person)) return;
  if(gold<25){log("❌ Недостатньо монет.");render();return;}
  if(!consumeAction("особиста винагорода NPC")) return;
  const before=relationshipSnapshot(person);
  gold-=25;
  person.loyalty=clamp(person.loyalty+2,0,BALANCE.maxAttribute);
  person.health=clamp(person.health+1,0,BALANCE.maxAttribute);
  adjustRelationship(person,{bond:3,affection:4,trust:1});
  logAction("🎁 "+profileName(person)+" отримує подарунок за 25 монет.","relation");
  showInteractionEvent(person,{name:"Особистий подарунок",scene:"Невеликий знак турботи помітно покращив настрій і нагадав, що праця не залишається непоміченою.",effects:{bond:1,affection:1,trust:1,loyalty:1,health:1}},before);
  saveGame(false);
  render();
}
function sellNPC(id,status){
  const arr=status==="slave"?ownedSlaves:ownedHirelings;
  const index=arr.findIndex(n=>n.id===id);
  if(index<0) return;
  const person=arr[index];
  if(!requireCurrentNpc(person)) return;
  if(!window.confirm(tr("Продати ","Sell ")+profileName(person)+tr("? Цю дію не можна скасувати.","? This action cannot be undone."))) return;
  if(!consumeAction(tr("продаж NPC","selling NPC"))) return;
  const value=Math.round(person.value*0.8);
  gold+=value;
  arr.splice(index,1);
  leaveProfileIfRemoved(person.id);
  adjustReputation(-1);
  logAction("💰 "+tr("Продано: ","Sold: ")+profileName(person)+tr(" за "," for ")+value+". "+tr("Репутація -1.","Reputation -1."),"danger");
  saveGame(false);
  render();
}
function dismissNPC(id,status){
  const arr=status==="slave"?ownedSlaves:ownedHirelings;
  const index=arr.findIndex(n=>n.id===id);
  if(index<0) return;
  const person=arr[index];
  if(!requireCurrentNpc(person)) return;
  if(person.spouse){
    log("❌ "+profileName(person)+" є чоловіком або дружиною головного героя і не може бути звільнений як працівник.");
    render();
    return;
  }
  if(!window.confirm("Звільнити "+profileName(person)+" зі служби?")) return;
  if(!consumeAction("звільнення працівника")) return;
  arr.splice(index,1);
  leaveProfileIfRemoved(person.id);
  adjustReputation(1);
  logAction("🚪 Звільнено: "+profileName(person)+". Репутація +1.","people");
  showInteractionEvent(person,{name:"Завершення служби",scene:"Ви розрахувалися і попрощалися. Від сьогодні шляхи торгового дому та цієї людини розходяться.",effects:{}},relationshipSnapshot(person));
  saveGame(false);
  render();
}
function executeNPC(id){
  const index=ownedSlaves.findIndex(n=>n.id===id);
  if(index<0) return;
  const person=ownedSlaves[index];
  if(!requireCurrentNpc(person)) return;
  if(!window.confirm("Підтвердити страту "+profileName(person)+"? Цю дію не можна скасувати.")) return;
  if(!consumeAction("страта")) return;
  ownedSlaves.splice(index,1);
  leaveProfileIfRemoved(person.id);
  adjustReputation(-3);
  logAction("⚔️ Страчено: "+profileName(person)+". Репутація -3.","danger");
  showInteractionEvent(person,{name:"Вирок виконано",scene:"Ваш наказ було виконано. Подія залишить важкий слід у пам'яті двору.",effects:{}},relationshipSnapshot(person));
  saveGame(false);
  render();
}
function moveFromSlavery(person){
  const index=ownedSlaves.findIndex(candidate=>candidate.id===person.id);
  if(index>=0) ownedSlaves.splice(index,1);
  if(!ownedHirelings.some(candidate=>candidate.id===person.id)) ownedHirelings.push(person);
}
function promoteSerf(id){
  const person=ownedSlaves.find(candidate=>candidate.id===id);
  if(!person) return;
  if(!requireCurrentNpc(person)) return;
  if(person.daysTogether<5 || person.obedience<6 || Math.max(person.strength,person.craft)<8){
    log("❌ Для переходу в кріпаки потрібно 5 днів разом, покірність 6 і сила або ремесло 8.");
    render();
    return;
  }
  if(!consumeAction("зміна статусу NPC")) return;
  const before=relationshipSnapshot(person);
  person.status="serf";
  if(person.gender==="female") person.portraitSet="female_serf_"+String((person.id%5)+1).padStart(2,"0");
  person.profession=jobTitle(person.job,false)||"Робітник";
  person.loyalty=clamp(person.loyalty+2,0,BALANCE.maxAttribute);
  adjustReputation(1);
  moveFromSlavery(person);
  logAction("📜 "+profileName(person)+" отримує статус кріпака. Репутація +1, лояльність +2.","people");
  showInteractionEvent(person,{name:"Новий статус",scene:"Перед свідками було оголошено новий статус і закріплено обов'язки у торговому домі.",effects:{loyalty:2}},before);
  saveGame(false);
  render();
}
function emancipateSlave(id,publicCeremony){
  const person=ownedSlaves.find(candidate=>candidate.id===id);
  if(!person) return;
  if(!requireCurrentNpc(person)) return;
  const cost=publicCeremony?45:20;
  if(gold<cost){log("❌ Для звільнення потрібно "+cost+" монет на документи й церемонію.");render();return;}
  if(!consumeAction("звільнення NPC")) return;
  const before=relationshipSnapshot(person);
  gold-=cost;
  person.status="citizen";
  person.profession=jobTitle(person.job,false)||"Вільний працівник";
  person.loyalty=clamp(person.loyalty+4,0,BALANCE.maxAttribute);
  adjustReputation(publicCeremony?3:2);
  moveFromSlavery(person);
  if(publicCeremony){
    ownedPeople().filter(other=>other.id!==person.id).forEach(other=>other.loyalty=clamp(other.loyalty+2,0,BALANCE.maxAttribute));
    logAction("🕊️ Публічно звільнено "+profileName(person)+". Репутація +3, лояльність інших +2.","people");
  }else{
    logAction("🕊️ "+profileName(person)+" отримує свободу і статус громадянина. Репутація +2.","people");
  }
  showInteractionEvent(person,{name:publicCeremony?"Публічне звільнення":"Звільнення",scene:publicCeremony?"На площі було оголошено волю цієї людини. Натовп побачив рішення торгового дому.":"Документи завершено: відтепер ця людина вільна і сама визначає своє майбутнє.",effects:{loyalty:4}},before);
  saveGame(false);
  render();
}
function grantCitizenship(id){
  const person=ownedHirelings.find(candidate=>candidate.id===id && candidate.status==="serf");
  if(!person) return;
  if(!requireCurrentNpc(person)) return;
  if(person.daysTogether<10 || person.loyalty<9 || jobSkill(person)<8){
    log("❌ Для громадянства потрібно 10 днів разом, лояльність 9 і робоча навичка 8.");
    render();
    return;
  }
  if(gold<50){log("❌ Для оформлення громадянства потрібно 50 монет.");render();return;}
  if(!consumeAction("надання громадянства")) return;
  const before=relationshipSnapshot(person);
  gold-=50;
  person.status="citizen";
  person.loyalty=clamp(person.loyalty+2,0,BALANCE.maxAttribute);
  adjustReputation(2);
  logAction("📜 "+profileName(person)+" отримує статус вільного громадянина. Репутація +2.","people");
  showInteractionEvent(person,{name:"Громадянство",scene:"Міський писар скріпив документи печаткою. Перед вами тепер вільний громадянин.",effects:{loyalty:2}},before);
  saveGame(false);
  render();
}
function releaseSlave(id){
  const index=ownedSlaves.findIndex(person=>person.id===id);
  if(index<0) return;
  const person=ownedSlaves[index];
  if(!requireCurrentNpc(person)) return;
  if(!window.confirm("Відпустити "+profileName(person)+" на волю? Людина залишить торговий дім.")) return;
  if(!consumeAction("звільнення на волю")) return;
  ownedSlaves.splice(index,1);
  leaveProfileIfRemoved(person.id);
  adjustReputation(2);
  ownedPeople().forEach(other=>other.loyalty=clamp(other.loyalty+1,0,BALANCE.maxAttribute));
  logAction("🕊️ "+profileName(person)+" відпущено на волю і залишає штаб. Репутація +2, лояльність інших +1.","people");
  showInteractionEvent(person,{name:"Відпускання на волю",scene:"Ворота штабу відчинилися, і ця людина пішла власною дорогою як вільна.",effects:{}},relationshipSnapshot(person));
  saveGame(false);
  render();
}
function publicExecuteNPC(id){
  const index=ownedSlaves.findIndex(person=>person.id===id);
  if(index<0) return;
  const person=ownedSlaves[index];
  if(!requireCurrentNpc(person)) return;
  if(!window.confirm("Підтвердити публічну страту "+profileName(person)+"? Це різко погіршить репутацію та лояльність.")) return;
  if(!consumeAction("публічна страта")) return;
  ownedSlaves.splice(index,1);
  leaveProfileIfRemoved(person.id);
  adjustReputation(-6);
  ownedSlaves.forEach(other=>{
    other.obedience=clamp(other.obedience+3,0,BALANCE.maxAttribute);
    other.loyalty=clamp(other.loyalty-3,0,BALANCE.maxAttribute);
  });
  ownedHirelings.forEach(other=>other.loyalty=clamp(other.loyalty-1,0,BALANCE.maxAttribute));
  logAction("⚔️ Публічно страчено "+profileName(person)+". Покірність рабів +3, їхня лояльність -3, репутація -6.","danger");
  showInteractionEvent(person,{name:"Публічний вирок",scene:"Покарання було виконано публічно. Двір замовк, а наслідки рішення відчують усі підлеглі.",effects:{}},relationshipSnapshot(person));
  saveGame(false);
  render();
}
function certifyMaster(id,status){
  const person=findOwned(id,status);
  if(!person || person.status==="slave") return;
  if(!requireCurrentNpc(person)) return;
  const title=jobTitle(person.job,true);
  if(!title || person.daysTogether<12 || jobSkill(person)<12){
    log("❌ Для звання майстра потрібні 12 днів служби, профільне призначення і навичка 12.");
    render();
    return;
  }
  if(gold<80){log("❌ Для визнання майстра потрібно 80 монет.");render();return;}
  if(!consumeAction("визнання майстра")) return;
  const before=relationshipSnapshot(person);
  gold-=80;
  person.mastery=person.job;
  person.profession=title;
  person.status="citizen";
  person.loyalty=clamp(person.loyalty+2,0,BALANCE.maxAttribute);
  adjustReputation(2);
  logAction("🏅 "+profileName(person)+" отримує звання «"+title+"». Репутація +2.","people");
  showInteractionEvent(person,{name:"Визнання майстра",scene:"У присутності ремісників ви вручили знак майстерності. Відтепер робота цієї людини має визнане ім'я.",effects:{loyalty:2}},before);
  saveGame(false);
  render();
}

function caravanDuration(route){
  const hasStableStaff=assignedStaff("Ферма").length>0;
  const stableReduction=hasStableStaff?Math.max(0,roomByKey("stable").level-1)+(caravanBoostUntil>=day?1:0):0;
  return Math.max(2,route.days-stableReduction);
}
function sendCaravan(routeId,goodName,requested){
  if(!CARAVAN_ENABLED){
    log("ℹ️ Караванна система тимчасово недоступна в цьому білді.","system");
    render();
    return;
  }
  const route=routeById(routeId);
  if(!route || route.from!==currentCity) return;
  const qty=Math.min(requested,inventoryCount(goodName));
  if(qty<1){log("❌ Вантажу вже немає на складі.");render();return;}
  const moneyToll=route.fee;
  const goodsToll=Math.max(1,Math.ceil(qty*0.2));
  if(gold<moneyToll && qty<=goodsToll){
    log("❌ Без монет для мита потрібен більший вантаж: частину товару має бути можливо залишити на заставі.");
    render();
    return;
  }
  if(!consumeAction("відправка каравану")) return;
  let shippedQty=qty;
  let tollText;
  if(gold>=moneyToll){
    gold-=moneyToll;
    tollText=moneyToll+" монет";
  }else{
    shippedQty-=goodsToll;
    tollText=goodsToll+" × "+goodName+" із вантажу";
  }
  removeItem(goodName,qty);
  activeCaravans.push({id:caravanId++,routeId:route.id,name:route.name,good:goodName,qty:shippedQty,remaining:caravanDuration(route),destination:route.to});
  logAction("🐎 Відправлено караван "+route.name+": у дорозі "+shippedQty+" × "+goodName+". Мито: "+tollText+".","caravan");
  saveGame(false);
  render();
}

function caravanRisk(route){
  const basic={Низький:0.10,Середній:0.23,Високий:0.38}[route.risk];
  const escorts=ownedHirelings.filter(n=>n.job==="Тренування"||n.job==="Склад").reduce((sum,n)=>sum+n.combat,0);
  const stableProtection=assignedStaff("Ферма").reduce((sum,person)=>sum+person.strength,0)/180+(roomByKey("stable").unlocked?roomFurnitureBonus(roomByKey("stable"),"routeSafety")/100:0);
  const protection=stableProtection+Math.min(0.14,escorts/120);
  return Math.max(BALANCE.minimumCaravanRisk,basic-protection);
}
function processCaravans(){
  activeCaravans.forEach(caravan=>caravan.remaining--);
  activeCaravans.filter(caravan=>caravan.remaining<=0).forEach(caravan=>{
    const route=routeById(caravan.routeId);
    const attacked=Math.random()<caravanRisk(route);
    const delivered=attacked?Math.floor(caravan.qty/2):caravan.qty;
    const income=delivered*salePrice(caravan.destination,caravan.good);
    if(income>0) gold+=income;
    marketGood(caravan.destination,caravan.good).stock+=delivered;
    if(attacked) log("⚠️ Караван "+caravan.name+" атаковано. Доставлено "+delivered+" з "+caravan.qty+" × "+caravan.good+", дохід "+income+".","caravan");
    else log("🐎 Караван прибув: "+caravan.name+". Продано "+delivered+" × "+caravan.good+" за "+income+".","caravan");
  });
  activeCaravans=activeCaravans.filter(caravan=>caravan.remaining>0);
}
function recoverNegativeReputations(){
  if(!reputationCalmDays) reputationCalmDays=cities.map(()=>0);
  cities.forEach((city,index)=>{
    if(cityReputation(index)>=0){reputationCalmDays[index]=0;return;}
    reputationCalmDays[index]=(reputationCalmDays[index]||0)+1;
    if(reputationCalmDays[index]>2){
      setCityReputation(index,cityReputation(index)+1);
      log("⚖️ У місті "+city.name+" трохи вщухли чутки про погані вчинки. Репутація +1, тепер "+cityReputation(index)+".","system");
    }
  });
}

function dailyUpkeep(){
  const base=0;
  const cooks=assignedStaff("Кухня");
  const house=roomByKey("house");
  const comfortSaving=roomFurnitureBonus(house,"upkeep");
  const kitchenSaving=cooks.length?Math.max(0,house.level-1)+Math.floor(cooks.reduce((sum,person)=>sum+person.craft,0)/4)+(kitchenUntil>=day?4:0)+comfortSaving:0;
  return Math.max(0,base-kitchenSaving);
}
function monthlyPayrollAmount(person){
  if(person.status==="child" || person.status==="slave") return 0;
  const usefulStats=person.strength+person.craft+person.combat+person.service+Math.floor((person.loyalty+person.health)/2);
  const statusBase=person.status==="citizen"?42:person.status==="serf"?22:32;
  const mastery=person.mastery?28:0;
  const ageFactor=person.age<26?1.2:person.age<36?1.1:person.age<50?1:person.age<63?0.86:0.72;
  const salary=(statusBase+usefulStats*2+mastery)*ageFactor;
  return Math.max(18,Math.round(salary/5)*5);
}
function processMonthlyPayroll(){
  if(day%30!==0) return;
  const paidPeople=ownedHirelings.filter(person=>monthlyPayrollAmount(person)>0);
  const payroll=paidPeople.reduce((sum,person)=>sum+monthlyPayrollAmount(person),0);
  if(payroll<1) return;
  if(gold>=payroll){
    gold-=payroll;
    paidPeople.forEach(person=>person.unpaidDays=0);
    log("🧾 Місячна платня підлеглим: -"+payroll+" монет.","hq");
  }else{
    paidPeople.forEach(person=>person.unpaidDays=(person.unpaidDays||0)+1);
    log("⚠️ У скарбниці не вистачило грошей на місячну платню ("+payroll+"). Працівники починають рахувати дні без оплати.","danger");
  }
}
function processFinancialStress(){
  ownedHirelings.slice().forEach(person=>{
    if(monthlyPayrollAmount(person)<1) return;
    if((person.unpaidDays||0)<1 && gold>=0) return;
    const salary=monthlyPayrollAmount(person);
    if((person.unpaidDays||0)>0 && gold>=salary){
      gold-=salary;
      log("🧾 Борг із платні виплачено: "+profileName(person)+" отримує "+salary+" монет.","hq");
      person.unpaidDays=0;
      return;
    }
    if((person.unpaidDays||0)>0 && day%30===0) return;
    person.unpaidDays=(person.unpaidDays||0)+1;
    if(person.unpaidDays>=BALANCE.unpaidDismissDays){
      ownedHirelings=ownedHirelings.filter(candidate=>candidate.id!==person.id);
      leaveProfileIfRemoved(person.id);
      log("🚪 "+profileName(person)+" звільнився після "+person.unpaidDays+" днів без платні.","danger");
    }else{
      log("⚠️ "+profileName(person)+" не отримує платню вже "+person.unpaidDays+" дн. На третій день піде з дому.","danger");
    }
  });
}
function farmFoodProduction(apply){
  const room=roomByKey("stable");
  if(!room || !room.unlocked) return 0;
  const farmerPower=assignedStaff("Ферма").reduce((sum,person)=>sum+person.strength+Math.floor(person.service/2),0);
  if(farmerPower<1) return 0;
  const produced=Math.floor(inventoryCount("Кури")/3)+inventoryCount("Корови")*2+Math.floor(inventoryCount("Вівці")/2)+Math.floor(inventoryCount("Свині")/2)+Math.floor(farmerPower/8)+room.level;
  if(apply && produced>0) food+=produced;
  return produced;
}
function processFarm(){
  const produced=farmFoodProduction(true);
  if(produced>0) log("🌾 Ферма виробила їжу: +"+produced+". Запас їжі: "+food+".","hq");
  if(day%7===0 && assignedStaff("Ферма").length){
    ["Кури","Свині","Корови","Вівці"].forEach(name=>{
      if(inventoryCount(name)>=2 && Math.random()<0.45){
        addItem(name,1);
        log("🐣 На фермі збільшилось поголів'я: +1 × "+name+".","hq");
      }
    });
  }
}
function feedSlaves(){
  const required=ownedSlaves.length*BALANCE.slaveFoodPerDay;
  if(required<1) return;
  const eaten=Math.min(food,required);
  food-=eaten;
  const shortage=required-eaten;
  if(shortage>0){
    ownedSlaves.forEach(person=>{
      person.starvingDays=(person.starvingDays||0)+1;
      person.health=clamp(person.health-1,0,BALANCE.maxAttribute);
      person.loyalty=clamp(person.loyalty-1,0,BALANCE.maxAttribute);
      person.obedience=clamp(person.obedience-1,0,BALANCE.maxAttribute);
    });
    const riotDamage=Math.min(Math.max(0,gold),shortage*8+ownedSlaves.length*2);
    if(riotDamage>0) gold-=riotDamage;
    adjustReputation(-1,player.headquartersCity??currentCity);
    log("🍲 Не вистачило їжі для рабів: потрібно "+required+", доступно "+eaten+". Починається бунт: здоров'я, лояльність і покірність -1, репутація -1"+(riotDamage>0?", збитки -"+riotDamage+" монет":"")+".","danger");
    ownedSlaves.slice().forEach(person=>{
      if((person.starvingDays||0)>=BALANCE.slaveDeathWithoutFoodDays){
        ownedSlaves=ownedSlaves.filter(candidate=>candidate.id!==person.id);
        leaveProfileIfRemoved(person.id);
        log("☠️ "+profileName(person)+" помер після "+person.starvingDays+" днів без їжі.","danger");
      }
    });
  }else{
    ownedSlaves.forEach(person=>person.starvingDays=0);
    log("🍲 Рабів нагодовано: -"+required+" їжі.","hq");
  }
}
function workshopYield(key){
  return 1+Math.floor((roomByKey(key).level-1)/2);
}
function addWorkshopOutput(name,requested){
  const qty=Math.max(0,Math.min(requested,warehouseCapacity()-cargoUsed()));
  if(qty>0) addItem(name,qty);
  return qty;
}
function creditGoodsProduced(job,qty){
  if(qty<1) return;
  const staff=assignedStaff(job).slice().sort((a,b)=>b.craft-a.craft);
  if(staff.length) staff[0].goodsProduced+=qty;
}
function consumeFirst(names,qty){
  const match=names.find(name=>inventoryCount(name)>=qty);
  if(!match) return null;
  removeItem(match,qty);
  return match;
}
// === v0.43: Skill drift system ===
// Base growth rates per workshop. Multiple stats may grow simultaneously
// (primary fast, secondary slow). All values mean "points per day at stat=0".
const SKILL_DRIFT_RATES={
  "Склад":       {strength:0.30, craft:0.05},
  "Тренування":  {combat:0.50},
  "Ткацький цех":{craft:0.45},
  "Кузня":       {craft:0.45, strength:0.10},
  "Ювелірна майстерня":{craft:0.50},
  "Меблева майстерня":{craft:0.40, strength:0.05},
  "Ферма":       {strength:0.40, health:0.04, service:0.10},
  "Стайня":      {strength:0.40, health:0.04, service:0.10},
  "Кухня":       {craft:0.30, service:0.15},
  "Заїжджий двір":{service:0.45, loyalty:0.05},
  "Камера":      {obedience:0.30, loyalty:-0.15}
};
const SKILL_DRIFT_PRIMARY={
  "Склад":"strength","Тренування":"combat","Ткацький цех":"craft","Кузня":"craft",
  "Ювелірна майстерня":"craft","Меблева майстерня":"craft","Ферма":"strength",
  "Стайня":"strength","Кухня":"craft","Заїжджий двір":"service","Камера":"obedience"
};
function applySkillDrift(person,stat,baseRate){
  if(!person.skillDrift) person.skillDrift={};
  const cur=person[stat]||0;
  const max=BALANCE.maxAttribute||20;
  // Diminishing returns: from full speed at 0 down to 30% at max
  const slowdown=1-(cur/max)*0.7;
  // Trait bonus: if NPC has a matching trait bonus, +20% growth
  const traitBoost=(person.trait&&person.trait.stat===stat&&person.trait.bonus>0)?1.2:1.0;
  // Negative rates (Камера → loyalty) ignore slowdown
  const diffM=diffMult("skillDriftMult");
  const delta=baseRate>=0?baseRate*slowdown*traitBoost*diffM:baseRate;
  person.skillDrift[stat]=(person.skillDrift[stat]||0)+delta;
  // Tick whole integers
  while(person.skillDrift[stat]>=1){
    person.skillDrift[stat]-=1;
    person[stat]=clamp((person[stat]||0)+1,0,max);
  }
  while(person.skillDrift[stat]<=-1){
    person.skillDrift[stat]+=1;
    person[stat]=clamp((person[stat]||0)-1,0,max);
  }
}
function applyJobDrift(person){
  const job=person.job==="Стайня"?"Ферма":person.job;
  const rates=SKILL_DRIFT_RATES[job];
  if(!rates) return;
  Object.entries(rates).forEach(([stat,rate])=>applySkillDrift(person,stat,rate));
}
function aspirationBlockHtml(person){
  ensureAspiration(person);
  if(!person.aspiration){
    return `<div class="profile-block aspiration-block"><h3>${tr("Аспірація","Aspiration")}</h3><p class="muted">${tr("Ця людина не має чітких прагнень.","This person has no clear aspirations.")}</p></div>`;
  }
  const data=getAspirationData(person);
  if(!data) return "";
  const title=data.title[lang==="en"?"en":"uk"];
  const desc=data.desc[lang==="en"?"en":"uk"];
  if(person.aspiration.resolved){
    return `<div class="profile-block aspiration-block aspiration-resolved"><h3>${data.icon} ${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p><p class="aspiration-resolution-tag">✓ ${tr("Завершено","Resolved")}: ${escapeHtml(person.aspiration.resolved)}</p></div>`;
  }
  const stepsHtml=data.steps.map((step,i)=>{
    const done=i<person.aspiration.stepIndex;
    const cls=done?"asp-step done":"asp-step";
    const icon=done?"✓":"○";
    return `<div class="${cls}"><span class="asp-step-icon">${icon}</span> ${escapeHtml(aspirationStepLabel(person,step))}</div>`;
  }).join("");
  const ready=person.aspiration.stepIndex>=data.steps.length;
  const readyTag=ready?`<p class="aspiration-ready">⚡ ${tr("Готовий поговорити з тобою","Ready to speak with you")}</p>`:"";
  return `<div class="profile-block aspiration-block"><h3>${data.icon} ${tr("Аспірація","Aspiration")}: ${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p><div class="asp-steps">${stepsHtml}</div>${readyTag}</div>`;
}

function skillProgressPct(person,stat){
  if(!person.skillDrift||person.skillDrift[stat]==null) return 0;
  const v=person.skillDrift[stat];
  return Math.max(0,Math.min(99,Math.round(v*100)));
}
function statRowHtml(person,stat,label){
  const val=person[stat]||0;
  const pct=skillProgressPct(person,stat);
  const max=BALANCE.maxAttribute||20;
  const normalizedJob=person.job==="Стайня"?"Ферма":person.job;
  const rates=SKILL_DRIFT_RATES[normalizedJob]||{};
  const isPrimary=SKILL_DRIFT_PRIMARY[normalizedJob]===stat;
  const isGrowing=rates[stat]!==undefined && rates[stat]>0 && val<max;
  const isShrinking=rates[stat]!==undefined && rates[stat]<0 && val>0;
  let mark="";
  if(isPrimary) mark=` <span class="stat-mark stat-primary" title="${tr('Основна навичка цієї роботи','Primary stat of this job')}">★</span>`;
  else if(isGrowing) mark=` <span class="stat-mark stat-growing" title="${tr('Розвивається','Growing')}">▲</span>`;
  else if(isShrinking) mark=` <span class="stat-mark stat-shrinking" title="${tr('Атрофується','Decaying')}">▼</span>`;
  const bar=(isGrowing||isShrinking)?`<div class="stat-drift-bar"><span style="width:${pct}%"></span></div>`:`<div class="stat-drift-bar"><span style="width:0%"></span></div>`;
  const pctTxt=(isGrowing||isShrinking)?`<span class="stat-pct">${pct}%</span>`:"";
  return `<div class="stat-row"><span class="stat-label">${label}: <b>${val}</b>/${max}${mark}</span>${bar}${pctTxt}</div>`;
}

function processWorkers(){
  ownedPeople().forEach(person=>{
    person.daysTogether++;
    if(person.job!=="Без роботи" && person.job!=="Зростає в родині" && !jobIsAvailable(person.job)) return;
    if(person.job!=="Без роботи" && person.job!=="Зростає в родині" && hasHeadquarters() && person.locationCity!==player.headquartersCity) return;
    // Run workshop production (preserves existing items output)
    if(person.job==="Ткацький цех"){
      const production=manufactureWorkshopProduct("weaving","Килими",person);
      if(production) log("🧵 "+profileName(person)+" виготовив "+production.amount+" × Килими із товару "+production.materials[0][0]+".","hq");
    }else if(person.job==="Кузня"){
      const production=manufactureWorkshopProduct("forge","Інструменти",person);
      if(production) log("🔨 "+profileName(person)+" виготовив "+production.amount+" × Інструменти із заліза.","hq");
    }else if(person.job==="Ювелірна майстерня"){
      const production=manufactureWorkshopProduct("jewelry","Прикраси",person);
      if(production) log("💍 "+profileName(person)+" виготовив "+production.amount+" × Прикраси.","hq");
    }else if(person.job==="Меблева майстерня"){
      const production=manufactureWorkshopProduct("furniture","Меблі",person);
      if(production) log("🪑 "+profileName(person)+" виготовив "+production.amount+" × Меблі.","hq");
    }
    // Apply skill drift
    applyJobDrift(person);
    // Bonus: Тренування scales slightly with room level
    if(person.job==="Тренування"){
      const lvl=roomByKey("training").level||1;
      if(lvl>1) applySkillDrift(person,"combat",0.1*(lvl-1));
    }
  });
}
function applyHomeComfort(){
  const house=roomByKey("house");
  const comfort=roomFurnitureBonus(house,"comfort");
  if(!house.familyWingRestored) return;
  ownedHirelings.filter(person=>person.spouse || person.childOf).forEach(person=>{
    const privateComfort=(person.privateFurnishings||[]).reduce((sum,id)=>sum+(homeItemById(id)&&homeItemById(id).effects.comfort||0),0);
    const total=comfort+privateComfort;
    person.health=clamp(person.health+Math.floor(total/5),0,BALANCE.maxAttribute);
    person.loyalty=clamp(person.loyalty+Math.floor(total/6),0,BALANCE.maxAttribute);
  });
}
function npcDailyReport(){
  ownedPeople().forEach(person=>{
    let account;
    if(person.status==="child") account="провів день під опікою родини";
    else if(person.job==="Без роботи") account="не мав призначеної роботи";
    else if(!jobIsAvailable(person.job)) account="чекав, доки буде відкрите потрібне приміщення";
    else if(person.job==="Камера") account="перебував у камері; покірність "+person.obedience+", лояльність "+person.loyalty;
    else account="працював: "+person.job+"; внесок +"+(person.lastIncome||0)+" монет";
    log("👤 "+profileName(person)+": "+account+". Здоров'я "+person.health+", лояльність "+person.loyalty+".","people");
  });
}
function collectHeadquartersIncome(){
  ownedPeople().forEach(person=>person.lastIncome=0);
  const entries=["forge","weaving","jewelry","furniture","stable","house","inn"].map(key=>{
    const room=roomByKey(key);
    let income=0;
    assignedStaff(room.job).forEach(person=>{
      const contribution=staffIncomeForRoom(person,key);
      income+=contribution;
      person.lastIncome+=contribution;
      person.earningsTotal+=contribution;
      if(contribution>0) person.earningsDays++;
    });
    return {name:room.name,income};
  }).filter(entry=>entry.income>0);
  const income=entries.reduce((sum,entry)=>sum+entry.income,0);
  if(income>0){
    gold+=income;
    log("🏰 Дохід штабу: +"+income+" ("+entries.map(entry=>entry.name+" +"+entry.income).join(", ")+").","hq");
  }
}
function refreshMarkets(){
  markets.forEach((market,cityIndex)=>{
    market.goods.forEach(g=>{
      const pull=Math.round((g.naturalStock-g.stock)*BALANCE.marketReversion);
      g.stock=clamp(g.stock+pull+rand(-1,2),1,80);
      if(g.shockDays>0){
        g.shockDays--;
        if(g.shockDays<=0){g.shock=1;g.shockType=null;}
        else g.shock=g.shock+(1-g.shock)*0.34;
      }
      repriceGood(g);
    });
    maybeStartShock(cityIndex);
  });
}
// Випадковий ринковий шок: дефіцит підіймає ціни й висушує запас, надлишок навпаки.
function maybeStartShock(cityIndex){
  if(Math.random()>=BALANCE.marketShockChance) return;
  const market=markets[cityIndex];
  const g=pick(market.goods);
  if(g.shockDays>0) return;
  const shortage=Math.random()<0.5;
  if(shortage){
    g.shock=1.4+Math.random()*0.4;
    g.stock=clamp(Math.round(g.stock*0.4),1,80);
    g.shockType="shortage";
  }else{
    g.shock=0.55+Math.random()*0.2;
    g.stock=clamp(g.stock+rand(18,30),1,80);
    g.shockType="glut";
  }
  g.shockDays=rand(BALANCE.marketShockDaysMin,BALANCE.marketShockDaysMax);
  repriceGood(g);
  if(cityIndex===currentCity){
    log((shortage?"📈 Дефіцит на ринку: ":"📉 Надлишок на ринку: ")+g.name+(shortage?". Ціни підскочили.":". Ціни впали."),"market");
  }else if(shortage && Math.random()<0.5){
    log("📨 Звістка з "+cities[cityIndex].name+": дефіцит товару «"+g.name+"» — там його купують дорожче.","market");
  }
}
function replenishNpcMarket(){
  if(day%3!==0) return;
  cities.forEach((city,index)=>{
    const localCount=npcMarket.filter(person=>person.city===index).length;
    if(localCount>=8) return;
    const person=makeNPC(rand(1,4)===4?"slave":"free",index);
    npcMarket.push(person);
    if(index===currentCity) log("👥 На місцевий ринок прибув новий кандидат: "+profileName(person)+".","people");
  });
}

function applyDailyEvent(){
  // v0.43: guard against an empty/malformed dailyEvents array
  if(!Array.isArray(dailyEvents)||!dailyEvents.length) return;
  const event=dailyEvents[rand(0,dailyEvents.length-1)];
  if(!Array.isArray(event)||event.length<3) return;
  let money=event[2];
  let text=event[1];
  const storageSecurity=roomByKey("warehouse").unlocked?roomFurnitureBonus(roomByKey("warehouse"),"security"):0;
  if(money<0 && (securityUntil>=day || storageSecurity>0) && (event[0].includes("крадіжка")||event[0].includes("грабіжник"))){
    money=Math.ceil(money*(storageSecurity>=2?0.4:0.5));
    text+=" Облаштування та охорона складу зменшили втрати.";
  }
  gold+=money;
  adjustReputation(event[3]);
  document.getElementById("eventTitle").innerText=event[0];
  document.getElementById("eventText").innerText=text;
  document.getElementById("eventEffect").innerHTML=`<span class="badge">Гроші: ${money>=0?"+":""}${money}</span><span class="badge">Репутація: ${event[3]>=0?"+":""}${event[3]}</span>`;
  log("🌙 Подія: "+event[0]+". Гроші "+(money>=0?"+":"")+money+", репутація "+(event[3]>=0?"+":"")+event[3]+".","system");
}
function advanceDay(withEvent,showSummary=true){
  const completedDay=day;
  const previousEntries=daySummary.slice();
  day++;
  energy=dailyActionLimit();
  // v0.43: check season transition + npc requests
  if(((day-1)%30)===0){
    const s=currentSeason();
    log("🗓️ Розпочався новий сезон: "+s.icon+" "+s.name+". Ціни на ринку зміняться.","system");
  }
  // restore NPCs from home visits
  [...ownedHirelings,...ownedSlaves].forEach(p=>{
    if(p.awayUntil && day>=p.awayUntil){
      delete p.awayUntil;
      log("🏠 "+profileName(p)+" повернувся з рідного міста.","relation");
    }
  });
  checkExpiredRequest();
  processNpcRequests();
  // v0.43 #2: Aspirations
  ownedPeople().forEach(p=>processAspiration(p));
  if(pendingAspirationId!=null && document.getElementById("npcRequestNotice").classList.contains("hidden")) showAspirationResolution();
  // v0.43 #2: Partnership income from departed NPCs
  if(player.partnershipIncome){
    gold+=player.partnershipIncome;
    log("🤝 "+tr("Партнерські відрахування","Partnership income")+": +"+player.partnershipIncome+" 💰","relation");
  }
  // v0.43 #2: Disillusioned NPCs slowly lose loyalty
  ownedPeople().forEach(p=>{
    if(p.disillusioned && (day-p.aspiration.startedDay)%7===0){
      p.loyalty=clamp((p.loyalty||0)-1,0,BALANCE.maxAttribute);
    }
  });
  daySummary=[];
  const upkeep=dailyUpkeep();
  if(upkeep>0){
    gold-=upkeep;
    log("🧾 Витрати на утримання людей: -"+upkeep+".","hq");
  }
  processMonthlyPayroll();
  processFarm();
  feedSlaves();
  collectHeadquartersIncome();
  processFinancialStress();
  processWorkers();
  processFamily();
  processMortality();
  applyHomeComfort();
  npcDailyReport();
  processCaravans();
  refreshMarkets();
  replenishNpcMarket();
  expireQuests();
  recoverNegativeReputations();
  if(withEvent) applyDailyEvent();
  const summaryEntries=previousEntries.concat(daySummary);
  daySummary=[];
  if(showSummary) showDaySummary(completedDay,summaryEntries);
  saveGame(false);
  render();
}
// === v0.43 NPC Aspirations (#2) ===
// Each hope archetype maps to a multi-step personal quest. The final step
// triggers a resolution dialog where the player chooses how to respond.
function cityIndexByName(name){
  return cities.findIndex(c=>c.name===name);
}
function removeOwnedPerson(person){
  if(!person) return;
  ownedHirelings=ownedHirelings.filter(p=>p.id!==person.id);
  ownedSlaves=ownedSlaves.filter(p=>p.id!==person.id);
  // v0.43: also clear from travel state so the NPC doesn't ghost in the dock/UI
  if(Array.isArray(travelCompanionIds)) travelCompanionIds=travelCompanionIds.filter(id=>id!==person.id);
  if(Array.isArray(selectedTravelCompanions)) selectedTravelCompanions=selectedTravelCompanions.filter(id=>id!==person.id);
  if(activeNpcRequest && activeNpcRequest.personId===person.id){
    activeNpcRequest=null;
    if(typeof hideNpcRequestNotice==="function") hideNpcRequestNotice();
  }
}
const NPC_ASPIRATIONS=[
  {key:"own_shop",icon:"🏪",
    match:/власну лавку|майстерню|ремесл/i,
    title:{uk:"Власна майстерня",en:"Own workshop"},
    desc:{uk:"Мріє покинути службу й відкрити справу в рідному місті.",en:"Dreams of leaving service to open a workshop in their hometown."},
    steps:[
      {key:"skill",
       label:{uk:p=>`Майстерність: ${(p.craft||0)}/12 craft`,en:p=>`Mastery: ${(p.craft||0)}/12 craft`},
       check:p=>(p.craft||0)>=12},
      {key:"saved",
       label:{uk:p=>`Заробіток: ${p.earningsTotal||0}/250 монет`,en:p=>`Earned: ${p.earningsTotal||0}/250 coins`},
       check:p=>(p.earningsTotal||0)>=250}
    ],
    resolution:{
      uk:p=>`<b>${profileName(p)}</b> впав перед тобою на коліна: «Я зібрав усе, що мені потрібно, пане. Дозволь мені відкрити власну майстерню у ${p.homeCity}». Вирішуй його долю.`,
      en:p=>`<b>${profileName(p)}</b> kneels before you: "I have all I need, lord. Allow me to open my own workshop in ${p.homeCity}." Decide their fate.`,
      options:[
        {key:"release",
         label:{uk:"🎁 Відпустити з благословенням (+30 рідне місто, постійна знижка 10%)",en:"🎁 Bless their leaving (+30 home city rep, permanent 10% discount)"},
         apply:p=>{
           const ci=cityIndexByName(p.homeCity);
           if(ci>=0){adjustReputation(30,ci);player.discountCities=player.discountCities||[];if(!player.discountCities.includes(ci)) player.discountCities.push(ci);}
           removeOwnedPerson(p);
           log("🏪 "+profileName(p)+" відкриває власну майстерню у "+p.homeCity+". Знижка 10% на ринку цього міста закріплена за тобою.","relation");
         }},
        {key:"partnership",
         label:{uk:"🤝 Партнерство — 500 монет (+8 монет/день назавжди)",en:"🤝 Partnership — 500 coins (+8 coins/day forever)"},
         requireGold:500,
         apply:p=>{
           gold-=500;
           player.partnershipIncome=(player.partnershipIncome||0)+8;
           removeOwnedPerson(p);
           log("🤝 Партнерство з "+profileName(p)+" закладено. Прибуток +8 монет щодня.","relation");
         }},
        {key:"block",
         label:{uk:"🔒 Затримати (вічна гіркота: +20% виробництва, -1 лояльність/тиждень)",en:"🔒 Detain (eternal bitterness: +20% output, -1 loyalty/week)"},
         apply:p=>{
           p.disillusioned=true;
           p.loyalty=clamp((p.loyalty||0)-3,0,BALANCE.maxAttribute);
           log("🔒 "+profileName(p)+" лишається, та з гіркотою в очах. Мрія його зламана.","relation");
         }}
      ]
    }},
  {key:"family_money",icon:"👨‍👩‍👧",
    match:/гроші для родини|для родини/i,
    title:{uk:"Гроші для родини",en:"Money for family"},
    desc:{uk:"Хоче зібрати велику суму й відправити рідним.",en:"Wants to gather a large sum and send it home."},
    steps:[
      {key:"earn",
       label:{uk:p=>`Зароблено: ${p.earningsTotal||0}/400 монет`,en:p=>`Earned: ${p.earningsTotal||0}/400 coins`},
       check:p=>(p.earningsTotal||0)>=400}
    ],
    resolution:{
      uk:p=>`<b>${profileName(p)}</b> зізнається: він зібрав 400 монет і хоче відправити їх родині у ${p.homeCity}. Просить додати 100 монет на гонця та подарунки.`,
      en:p=>`<b>${profileName(p)}</b> confesses: they have saved 400 coins and wish to send them home to ${p.homeCity}. They ask for 100 more for a courier and gifts.`,
      options:[
        {key:"add100",
         label:{uk:"💰 Додати 100 монет (+8 bond, +5 loyalty)",en:"💰 Add 100 coins (+8 bond, +5 loyalty)"},
         requireGold:100,
         apply:p=>{gold-=100;p.bond=clamp((p.bond||0)+8,0,100);p.loyalty=clamp((p.loyalty||0)+5,0,BALANCE.maxAttribute);log("💌 "+profileName(p)+" відправив посилку додому. Лояльність +5.","relation");}},
        {key:"refuse_polite",
         label:{uk:"🙅 Чемно відмовити (нейтрально)",en:"🙅 Politely decline (neutral)"},
         apply:p=>{p.bond=clamp((p.bond||0)-2,0,100);log("🙅 "+profileName(p)+" приймає відмову мовчки.","relation");}},
        {key:"forbid",
         label:{uk:"🔒 Заборонити (-10 bond, -5 loyalty)",en:"🔒 Forbid (-10 bond, -5 loyalty)"},
         apply:p=>{p.bond=clamp((p.bond||0)-10,0,100);p.loyalty=clamp((p.loyalty||0)-5,0,BALANCE.maxAttribute);log("🔒 "+profileName(p)+" з гіркотою змирився. Мрія його розбита.","relation");}}
      ]
    }},
  {key:"new_craft",icon:"📚",
    match:/новому ремеслу|навчитися/i,
    title:{uk:"Опанувати ремесло",en:"Master a craft"},
    desc:{uk:"Прагне досягти майстерності у вибраній справі.",en:"Strives to reach mastery in a chosen craft."},
    steps:[
      {key:"days",
       label:{uk:p=>`Час разом: ${p.daysTogether||0}/45 днів`,en:p=>`Days together: ${p.daysTogether||0}/45 days`},
       check:p=>(p.daysTogether||0)>=45},
      {key:"craft",
       label:{uk:p=>`Ремесло: ${(p.craft||0)}/14`,en:p=>`Craft: ${(p.craft||0)}/14`},
       check:p=>(p.craft||0)>=14}
    ],
    resolution:{
      uk:p=>`<b>${profileName(p)}</b> опанував своє ремесло настільки, що тепер може зватися майстром. Він просить тебе офіційно визнати його статус.`,
      en:p=>`<b>${profileName(p)}</b> has mastered their craft enough to be called Master. They ask you to officially recognise their status.`,
      options:[
        {key:"certify",
         label:{uk:"⭐ Визнати майстром (+50 рідне місто, виробництво +30%)",en:"⭐ Recognise as master (+50 home rep, +30% output)"},
         apply:p=>{
           p.mastery=p.job||"Ремесло";
           const ci=cityIndexByName(p.homeCity);
           if(ci>=0) adjustReputation(50,ci);
           p.loyalty=clamp((p.loyalty||0)+5,0,BALANCE.maxAttribute);
           log("⭐ "+profileName(p)+" отримав визнання майстром. Виробництво +30%.","relation");
         }},
        {key:"delay",
         label:{uk:"⏳ Відкласти ще на місяць (-3 bond)",en:"⏳ Delay another month (-3 bond)"},
         apply:p=>{p.bond=clamp((p.bond||0)-3,0,100);p.nextAspirationCheck=day+30;log("⏳ "+profileName(p)+" мусить ще зачекати.","relation");}}
      ]
    }},
  {key:"see_city",icon:"🏛️",
    match:/побачити|сподівається побачити/i,
    title:{uk:"Побачити Венецію",en:"See Venice"},
    desc:{uk:"Мріє хоч раз пройтися каналами далекого великого міста.",en:"Dreams of walking the canals of a distant great city at least once."},
    targetCityName:"Венеція",
    steps:[
      {key:"visit",
       label:{uk:p=>p.aspirationFlags&&p.aspirationFlags.visitedTarget?"Місто відвідано ✓":"Прибути до Венеції разом із героєм",
              en:p=>p.aspirationFlags&&p.aspirationFlags.visitedTarget?"City visited ✓":"Arrive in Venice with the hero"},
       check:p=>!!(p.aspirationFlags&&p.aspirationFlags.visitedTarget)}
    ],
    resolution:{
      uk:p=>`<b>${profileName(p)}</b> довго стояв на мармурових сходах Венеції, аж сльози навернулися. Мрія здійснилася. Він віддячує вірною службою.`,
      en:p=>`<b>${profileName(p)}</b> stood on Venice's marble steps until tears welled up. The dream is fulfilled. They repay you with faithful service.`,
      options:[
        {key:"accept",
         label:{uk:"💞 Прийняти подяку (+10 bond, +5 loyalty, +30 service%)",en:"💞 Accept their gratitude (+10 bond, +5 loyalty, +30% service)"},
         apply:p=>{p.bond=clamp((p.bond||0)+10,0,100);p.loyalty=clamp((p.loyalty||0)+5,0,BALANCE.maxAttribute);p.service=clamp((p.service||0)+3,0,BALANCE.maxAttribute);log("💞 "+profileName(p)+" сяє від щастя. Зв'язок зміцнів.","relation");}}
      ]
    }},
  {key:"safe_home",icon:"🏠",
    match:/безпечне житло|житло/i,
    title:{uk:"Безпечне житло",en:"A safe home"},
    desc:{uk:"Хоче мати власну приватну кімнату у штабі.",en:"Wishes to have their own private room in the headquarters."},
    steps:[
      {key:"loyalty",
       label:{uk:p=>`Лояльність: ${p.loyalty||0}/12`,en:p=>`Loyalty: ${p.loyalty||0}/12`},
       check:p=>(p.loyalty||0)>=12},
      {key:"days",
       label:{uk:p=>`Час разом: ${p.daysTogether||0}/30 днів`,en:p=>`Days together: ${p.daysTogether||0}/30 days`},
       check:p=>(p.daysTogether||0)>=30}
    ],
    resolution:{
      uk:p=>`<b>${profileName(p)}</b> просить виділити йому приватну кімнату у штабі. За це він обіцяє довічну вірність дому.`,
      en:p=>`<b>${profileName(p)}</b> asks for a private room in the headquarters. In return they swear lifelong loyalty.`,
      options:[
        {key:"grant",
         label:{uk:"🏠 Виділити кімнату (-150 монет, +20 loyalty, +10 health назавжди)",en:"🏠 Grant a room (-150 coins, +20 loyalty, +10 health permanently)"},
         requireGold:150,
         apply:p=>{gold-=150;p.privateRoom=true;p.loyalty=clamp((p.loyalty||0)+10,0,BALANCE.maxAttribute);p.health=clamp((p.health||0)+5,0,BALANCE.maxAttribute);log("🏠 "+profileName(p)+" отримав власну кімнату. Лояльність +10, здоров'я +5.","relation");}},
        {key:"refuse",
         label:{uk:"🙅 Відмовити (-5 loyalty, -8 bond)",en:"🙅 Refuse (-5 loyalty, -8 bond)"},
         apply:p=>{p.loyalty=clamp((p.loyalty||0)-5,0,BALANCE.maxAttribute);p.bond=clamp((p.bond||0)-8,0,100);log("🙅 "+profileName(p)+" розчарований і похмурий.","relation");}}
      ]
    }},
  {key:"city_respect",icon:"🏅",
    match:/повагу міста|повагу/i,
    title:{uk:"Повага міста",en:"City respect"},
    desc:{uk:"Прагне здобути впізнаваність і шану в рідному місті.",en:"Strives for recognition and honour in their home city."},
    steps:[
      {key:"stat",
       label:{uk:p=>`Найвищий стат: ${Math.max(p.craft||0,p.combat||0,p.service||0)}/15`,en:p=>`Best stat: ${Math.max(p.craft||0,p.combat||0,p.service||0)}/15`},
       check:p=>Math.max(p.craft||0,p.combat||0,p.service||0)>=15},
      {key:"visit",
       label:{uk:p=>p.aspirationFlags&&p.aspirationFlags.visitedHome?"Рідне місто відвідано ✓":"Прибути в рідне місто з героєм",
              en:p=>p.aspirationFlags&&p.aspirationFlags.visitedHome?"Home city visited ✓":"Visit home city with the hero"},
       check:p=>!!(p.aspirationFlags&&p.aspirationFlags.visitedHome)}
    ],
    resolution:{
      uk:p=>`<b>${profileName(p)}</b> повернувся в ${p.homeCity} як визнаний майстер. Земляки спостерігають за ним з повагою. Він просить дозволу виступити на міському святі від імені твого дому.`,
      en:p=>`<b>${profileName(p)}</b> returns to ${p.homeCity} as a recognised master. The locals watch with respect. They ask leave to speak at the town festival in your house's name.`,
      options:[
        {key:"sponsor",
         label:{uk:"🎉 Влаштувати свято (-200 монет, +80 рідне місто, +15 загальна репутація)",en:"🎉 Host a festival (-200 coins, +80 home rep, +15 overall reputation)"},
         requireGold:200,
         apply:p=>{gold-=200;const ci=cityIndexByName(p.homeCity);if(ci>=0){adjustReputation(80,ci);}cities.forEach((_,i)=>adjustReputation(1,i));p.loyalty=clamp((p.loyalty||0)+8,0,BALANCE.maxAttribute);log("🎉 Свято на честь "+profileName(p)+" гримить у "+p.homeCity+". Слава твого дому розходиться Європою.","relation");}},
        {key:"modest",
         label:{uk:"🤲 Скромне визнання (+40 рідне місто)",en:"🤲 Modest acknowledgement (+40 home rep)"},
         apply:p=>{const ci=cityIndexByName(p.homeCity);if(ci>=0) adjustReputation(40,ci);p.bond=clamp((p.bond||0)+5,0,100);log("🤲 "+profileName(p)+" вдячно вклоняється.","relation");}}
      ]
    }}
];

function detectAspiration(person){
  if(!person.hope) return null;
  for(const a of NPC_ASPIRATIONS){
    if(a.match.test(person.hope)) return a.key;
  }
  return null;
}
function ensureAspiration(person){
  if(person.aspiration && person.aspiration.archetype) return;
  const key=detectAspiration(person);
  if(!key) return;
  person.aspiration={archetype:key,stepIndex:0,startedDay:day,resolved:null,readyTriggered:false};
  person.aspirationFlags=person.aspirationFlags||{};
}
function getAspirationData(person){
  if(!person.aspiration) return null;
  return NPC_ASPIRATIONS.find(a=>a.key===person.aspiration.archetype);
}
function aspirationStepLabel(person,step){
  const fn=step.label[lang==="en"?"en":"uk"];
  return typeof fn==="function"?fn(person):fn;
}
function processAspiration(person){
  if(person.status==="child") return;
  ensureAspiration(person);
  if(!person.aspiration||person.aspiration.resolved) return;
  const data=getAspirationData(person);
  if(!data) return;
  // Advance through steps
  let advanced=false;
  while(person.aspiration.stepIndex<data.steps.length){
    const step=data.steps[person.aspiration.stepIndex];
    if(step.check(person)){
      person.aspiration.stepIndex++;
      advanced=true;
    }else{
      break;
    }
  }
  // All steps complete → trigger resolution dialog (once)
  if(person.aspiration.stepIndex>=data.steps.length && !person.aspiration.readyTriggered){
    person.aspiration.readyTriggered=true;
    queueAspirationResolution(person);
  }
}
let pendingAspirationId=null;
function queueAspirationResolution(person){
  // Only one pending dialog at a time; if another is up, defer 1 day
  if(activeNpcRequest||pendingAspirationId){
    person.aspiration.readyTriggered=false; // try again tomorrow
    return;
  }
  pendingAspirationId=person.id;
  showAspirationResolution();
}
function showAspirationResolution(){
  const el=document.getElementById("npcRequestNotice");
  if(!el||pendingAspirationId==null) return;
  const person=findPersonById(pendingAspirationId);
  if(!person||!person.aspiration){pendingAspirationId=null;return;}
  const data=getAspirationData(person);
  if(!data){pendingAspirationId=null;return;}
  const text=data.resolution[lang==="en"?"en":"uk"](person);
  const opts=data.resolution.options.map(opt=>{
    const lbl=opt.label[lang==="en"?"en":"uk"];
    const disabled=opt.requireGold&&gold<opt.requireGold?"disabled":"";
    return `<button class="btn ${opt.key==="release"||opt.key==="grant"||opt.key==="certify"||opt.key==="sponsor"||opt.key==="accept"||opt.key==="add100"?"green":opt.key==="block"||opt.key==="forbid"?"red":"blue"}" ${disabled} onclick="resolveAspiration('${opt.key}')">${escapeHtml(lbl)}</button>`;
  }).join("");
  const aspIcon=data.icon;
  const titleLbl=data.title[lang==="en"?"en":"uk"];
  el.innerHTML=`<h3>${aspIcon} ${escapeHtml(profileName(person))} <span class="request-pin">${tr("аспірація","aspiration")}</span></h3>
    <p style="color:var(--gold);font-weight:700;font-size:13px;margin-bottom:4px">${escapeHtml(titleLbl)}</p>
    <p>${text}</p>
    <div class="req-actions">${opts}</div>`;
  el.classList.remove("hidden");
}
function resolveAspiration(optKey){
  if(pendingAspirationId==null) return;
  const person=findPersonById(pendingAspirationId);
  if(!person||!person.aspiration){pendingAspirationId=null;hideNpcRequestNotice();return;}
  const data=getAspirationData(person);
  if(!data){pendingAspirationId=null;hideNpcRequestNotice();return;}
  const opt=data.resolution.options.find(o=>o.key===optKey);
  if(!opt) return;
  if(opt.requireGold&&gold<opt.requireGold){
    log("❌ "+tr("Не вистачає монет на це рішення.","Not enough coins for this choice."),"relation");
    return;
  }
  opt.apply(person);
  person.aspiration.resolved=optKey;
  pendingAspirationId=null;
  hideNpcRequestNotice();
  saveGame(false);
  render();
}

// === v0.43 NPC Requests ===
const NPC_REQUEST_TYPES=[
  {key:"home_visit",weight:3,
    generate(person){
      const homeName=cityNameByName(person.homeCity);
      return {key:"home_visit",
        text:tr(`сумує за рідним містом ${homeName}. Просить дозволу відвідати рідних на кілька днів.`,
                `misses their home city of ${homeName}. Asks for leave to visit family for a few days.`),
        accept:tr("Відпустити (-50 монет, +лояльність, NPC недоступний 5 днів)","Let them go (-50 coins, +loyalty, NPC away 5 days)"),
        decline:tr("Відмовити (-2 лояльність)","Refuse (-2 loyalty)"),cost:50};
    },
    check(person){return person.status!=="slave"&&person.homeCity;},
    onAccept(person){
      if(gold<50){log("❌ Не вистачає 50 монет на дозвіл "+profileName(person)+".","relation");return false;}
      gold-=50;
      person.loyalty=clamp((person.loyalty||0)+3,0,BALANCE.maxAttribute);
      person.bond=clamp((person.bond||0)+4,0,100);
      person.awayUntil=day+rand(4,7);
      log("✅ "+profileName(person)+" вирушає додому. Лояльність зросла на +3.","relation");
      return true;
    },
    onDecline(person){
      person.loyalty=clamp((person.loyalty||0)-2,0,BALANCE.maxAttribute);
      person.bond=clamp((person.bond||0)-3,0,100);
      log("➖ "+profileName(person)+" розчарований відмовою. Лояльність -2.","relation");
    }
  },
  {key:"better_equipment",weight:2,
    generate(person){
      return {key:"better_equipment",
        text:tr(`скаржиться, що його спорядження зносилось. Просить виділити 120 монет на новий одяг.`,
                `complains that their gear is worn. Asks for 120 coins for new clothing.`),
        accept:tr("Виділити 120 монет (+3 гостинність, +лояльність)","Spend 120 coins (+3 hospitality, +loyalty)"),
        decline:tr("Відмовити (-2 лояльність)","Refuse (-2 loyalty)"),cost:120};
    },
    check(person){return person.status==="free"||person.status==="serf";},
    onAccept(person){
      if(gold<120){log("❌ Не вистачає 120 монет.","relation");return false;}
      gold-=120;
      person.service=clamp((person.service||0)+3,0,BALANCE.maxAttribute);
      person.loyalty=clamp((person.loyalty||0)+2,0,BALANCE.maxAttribute);
      log("✅ "+profileName(person)+" отримав нове спорядження. Гостинність +3, лояльність +2.","relation");
      return true;
    },
    onDecline(person){
      person.loyalty=clamp((person.loyalty||0)-2,0,BALANCE.maxAttribute);
      log("➖ "+profileName(person)+" розчарований. Лояльність -2.","relation");
    }
  },
  {key:"training",weight:2,
    generate(person){
      const stat=person.combat<person.craft?"combat":"craft";
      const statLbl=tr(stat==="combat"?"бій":"ремесло",stat==="combat"?"combat":"craft");
      return {key:"training",
        text:tr(`хоче вдосконалити навички (${statLbl}). Просить виділити 80 монет на тренування протягом тижня.`,
                `wants to sharpen their skills (${statLbl}). Asks for 80 coins for a week of training.`),
        accept:tr(`Заплатити 80 монет (+2 ${statLbl})`,`Pay 80 coins (+2 ${statLbl})`),
        decline:tr("Відмовити (-1 лояльність)","Refuse (-1 loyalty)"),cost:80,stat};
    },
    check(person){return person.status!=="slave"&&(person.combat||0)<14&&(person.craft||0)<14;},
    onAccept(person,req){
      if(gold<80){log("❌ Не вистачає 80 монет.","relation");return false;}
      gold-=80;
      person[req.stat]=clamp((person[req.stat]||0)+2,0,BALANCE.maxAttribute);
      person.loyalty=clamp((person.loyalty||0)+1,0,BALANCE.maxAttribute);
      log("✅ "+profileName(person)+" пройшов тренування. "+(req.stat==="combat"?"Бій":"Ремесло")+" +2.","relation");
      return true;
    },
    onDecline(person){
      person.loyalty=clamp((person.loyalty||0)-1,0,BALANCE.maxAttribute);
      log("➖ "+profileName(person)+" розчарований. Лояльність -1.","relation");
    }
  },
  {key:"freedom",weight:1,
    generate(person){
      return {key:"freedom",
        text:tr(`впав на коліна й благає про волю. Готовий служити вірно як вільна людина.`,
                `falls to their knees and begs for freedom. Promises to serve faithfully as a free person.`),
        accept:tr("Звільнити (статус → вільний, +лояльність)","Free them (status → free, +loyalty)"),
        decline:tr("Відмовити (-3 покірність, -3 лояльність)","Refuse (-3 obedience, -3 loyalty)")};
    },
    check(person){return person.status==="slave"&&(person.loyalty||0)>=6;},
    onAccept(person){
      person.status="free";
      person.loyalty=clamp((person.loyalty||0)+4,0,BALANCE.maxAttribute);
      person.bond=clamp((person.bond||0)+6,0,100);
      // move from slaves to hirelings
      ownedSlaves=ownedSlaves.filter(p=>p.id!==person.id);
      ownedHirelings.push(person);
      log("✅ "+profileName(person)+" отримав свободу і став найманцем. Лояльність +4.","relation");
      return true;
    },
    onDecline(person){
      person.obedience=clamp((person.obedience||0)-3,0,BALANCE.maxAttribute);
      person.loyalty=clamp((person.loyalty||0)-3,0,BALANCE.maxAttribute);
      log("➖ "+profileName(person)+" гірко плаче від відмови. Покірність та лояльність -3.","relation");
    }
  },
  {key:"bonus",weight:3,
    generate(person){
      return {key:"bonus",
        text:tr(`нагадує, що його праця заслуговує премії. Сподівається на 60 монет особистої винагороди.`,
                `reminds you that their work deserves a bonus. Hopes for 60 coins in personal reward.`),
        accept:tr("Виплатити 60 монет (+лояльність, +зв'язок)","Pay 60 coins (+loyalty, +bond)"),
        decline:tr("Відмовити (-1 лояльність)","Refuse (-1 loyalty)"),cost:60};
    },
    check(person){return person.status!=="slave"&&(person.daysTogether||0)>=15;},
    onAccept(person){
      if(gold<60){log("❌ Не вистачає 60 монет.","relation");return false;}
      gold-=60;
      person.loyalty=clamp((person.loyalty||0)+2,0,BALANCE.maxAttribute);
      person.bond=clamp((person.bond||0)+5,0,100);
      person.affection=clamp((person.affection||0)+3,0,100);
      log("✅ "+profileName(person)+" отримав премію. Лояльність +2, зв'язок +5.","relation");
      return true;
    },
    onDecline(person){
      person.loyalty=clamp((person.loyalty||0)-1,0,BALANCE.maxAttribute);
      log("➖ "+profileName(person)+" розчарований. Лояльність -1.","relation");
    }
  }
];
let activeNpcRequest=null;
function processNpcRequests(){
  // Generate one request per day max if conditions are right
  if(activeNpcRequest) return;
  const all=[...ownedHirelings,...ownedSlaves].filter(p=>p.status!=="child"&&(p.daysTogether||0)>=5&&!p.awayUntil);
  if(!all.length) return;
  // Each NPC has small chance to request per day
  const candidate=all[Math.floor(Math.random()*all.length)];
  if(Math.random()>0.12) return; // ~12% chance per day per check
  if(candidate.nextRequestDay && day<candidate.nextRequestDay) return;
  const validTypes=NPC_REQUEST_TYPES.filter(rt=>rt.check(candidate));
  if(!validTypes.length) return;
  // Weighted pick
  const totalW=validTypes.reduce((s,t)=>s+t.weight,0);
  let roll=Math.random()*totalW;
  let chosen=validTypes[0];
  for(const t of validTypes){if((roll-=t.weight)<=0){chosen=t;break;}}
  const req=chosen.generate(candidate);
  activeNpcRequest={personId:candidate.id,request:req,handlerKey:chosen.key,expiresOn:day+5};
  candidate.nextRequestDay=day+rand(10,18);
  showNpcRequestNotice();
  log("📜 "+profileName(candidate)+" звертається з проханням.","relation");
}
function findPersonById(id){
  return ownedHirelings.find(p=>p.id===id)||ownedSlaves.find(p=>p.id===id);
}
function showNpcRequestNotice(){
  const el=document.getElementById("npcRequestNotice");
  if(!el || !activeNpcRequest) return;
  const person=findPersonById(activeNpcRequest.personId);
  if(!person) return;
  const req=activeNpcRequest.request;
  el.innerHTML=`<h3>📜 ${escapeHtml(profileName(person))} <span class="request-pin">${tr("прохання","request")}</span></h3>
    <p><b>${escapeHtml(profileName(person))}</b> ${escapeHtml(req.text)}</p>
    <div class="req-actions">
      <button class="btn green" onclick="acceptNpcRequest()">${escapeHtml(req.accept)}</button>
      <button class="btn red" onclick="declineNpcRequest()">${escapeHtml(req.decline)}</button>
    </div>`;
  el.classList.remove("hidden");
}
function hideNpcRequestNotice(){
  const el=document.getElementById("npcRequestNotice");
  if(el) el.classList.add("hidden");
}
function acceptNpcRequest(){
  if(!activeNpcRequest) return;
  const person=findPersonById(activeNpcRequest.personId);
  if(!person) {activeNpcRequest=null;hideNpcRequestNotice();return;}
  const handler=NPC_REQUEST_TYPES.find(t=>t.key===activeNpcRequest.handlerKey);
  if(handler && handler.onAccept(person,activeNpcRequest.request)){
    activeNpcRequest=null;
    hideNpcRequestNotice();
    saveGame(false);
    render();
  }
}
function declineNpcRequest(){
  if(!activeNpcRequest) return;
  const person=findPersonById(activeNpcRequest.personId);
  if(person){
    const handler=NPC_REQUEST_TYPES.find(t=>t.key===activeNpcRequest.handlerKey);
    if(handler) handler.onDecline(person);
  }
  activeNpcRequest=null;
  hideNpcRequestNotice();
  saveGame(false);
  render();
}
function checkExpiredRequest(){
  if(activeNpcRequest && day>activeNpcRequest.expiresOn){
    const person=findPersonById(activeNpcRequest.personId);
    if(person){
      person.loyalty=clamp((person.loyalty||0)-1,0,BALANCE.maxAttribute);
      log("⏰ "+profileName(person)+" так і не дочекався відповіді на прохання. Лояльність -1.","relation");
    }
    activeNpcRequest=null;
    hideNpcRequestNotice();
  }
}

// v0.43: midgame ad runs (with cap) before the day actually advances on CrazyGames.
// On every other host the wrapper resolves immediately and gameplay is unchanged.
async function nextDay(){
  if(CG.isReady && CG.isReady() && CG.isCrazyGames && CG.isCrazyGames()){
    try{await CG.maybeMidgameAd(day);}catch(e){}
  }
  advanceDay(true);
}

// === v0.43: Rewarded ads ====================================================
// Player-initiated ads grant in-game rewards. Up to 3 per day, with per-type
// cooldowns so a single ad can't be farmed in a loop.
const AD_REWARDS = [
  {
    key:"gold",
    icon:"💰",
    name:{uk:"+200 монет",en:"+200 coins"},
    desc:{uk:"Швидке вливання у скарбницю.",en:"A quick boost to the treasury."},
    cooldownDays:1,
    apply(){gold+=200;log("📺💰 "+tr("Реклама → +200 монет.","Ad → +200 coins."),"system",true);}
  },
  {
    key:"actions",
    icon:"⚡",
    name:{uk:"+3 дії сьогодні",en:"+3 actions today"},
    desc:{uk:"Більше часу на справи сьогодні.",en:"More time for chores today."},
    cooldownDays:1,
    apply(){energy=Math.min(energy+3,dailyActionLimit()+3);log("📺⚡ "+tr("Реклама → +3 дії на сьогодні.","Ad → +3 actions today."),"system",true);}
  },
  {
    key:"restock",
    icon:"🎁",
    name:{uk:"Оновити крамницю міста",en:"Restock city shop"},
    desc:{uk:"Перерозіграти весь асортимент і кількість.",en:"Reroll the entire offer and quantities."},
    cooldownDays:2,
    apply(){
      if(!shopStock || !shopStock.cities) shopStock={cities:{}};
      delete shopStock.cities[currentCity];
      ensureShopStock();
      log("📺🎁 "+tr("Реклама → крамниця ","Ad → shop in ")+cityName(currentCity)+tr(" повністю оновлена."," fully restocked."),"shop",true);
    }
  }
];
function adRewardState(){
  if(!player) return {usedToday:0,history:{},day:0};
  player.adRewards=player.adRewards||{usedToday:0,history:{},day:0};
  // Reset daily counter when the in-game day changes
  if(player.adRewards.day!==day){player.adRewards.day=day;player.adRewards.usedToday=0;}
  return player.adRewards;
}
function adRewardAvailable(reward){
  const s=adRewardState();
  if(s.usedToday>=3) return {ok:false,reason:tr("Сьогодні бонусів більше немає (макс. 3 / день).","No more bonuses today (max 3 / day).")};
  const last=s.history[reward.key];
  if(last && day-last < (reward.cooldownDays||1)){
    const left=(reward.cooldownDays||1)-(day-last);
    return {ok:false,reason:tr("Знову через ","Try again in ")+left+tr(" дн.","d.")};
  }
  return {ok:true};
}
function showAdRewardButtonIfNeeded(){
  const btn=document.getElementById("adRewardBtn");
  if(!btn) return;
  const enabled=CG.isReady && CG.isReady() && CG.isCrazyGames && CG.isCrazyGames();
  btn.classList.toggle("hidden",!enabled);
}
function openAdRewardModal(){
  renderAdRewardOptions();
  document.getElementById("adRewardModal").classList.remove("hidden");
}
function closeAdRewardModal(){
  document.getElementById("adRewardModal").classList.add("hidden");
}
function renderAdRewardOptions(){
  const target=document.getElementById("adRewardOptions");
  if(!target) return;
  const s=adRewardState();
  document.getElementById("adRewardHint").innerText=tr("Подивись коротку рекламу — отримай корисний бонус. Сьогодні використано ","Watch a short ad to get a useful bonus. Used today: ")+s.usedToday+"/3.";
  target.innerHTML=AD_REWARDS.map(r=>{
    const name=lang==="en"?r.name.en:r.name.uk;
    const desc=lang==="en"?r.desc.en:r.desc.uk;
    const avail=adRewardAvailable(r);
    const btnLbl=avail.ok?(tr("📺 Подивитися","📺 Watch")):escapeHtml(avail.reason);
    return `<button class="ad-reward-card" ${avail.ok?"":"disabled"} onclick="claimAdReward('${r.key}')"><div class="ad-reward-icon">${r.icon}</div><div class="ad-reward-name">${escapeHtml(name)}</div><div class="ad-reward-desc">${escapeHtml(desc)}</div><div class="ad-reward-cta">${btnLbl}</div></button>`;
  }).join("");
}
async function claimAdReward(key){
  const reward=AD_REWARDS.find(r=>r.key===key);
  if(!reward) return;
  const avail=adRewardAvailable(reward);
  if(!avail.ok){alert(avail.reason);return;}
  // Disable all buttons during the ad
  document.querySelectorAll("#adRewardOptions .ad-reward-card").forEach(b=>b.disabled=true);
  let ok=false;
  try{ok=await CG.rewardedAd();}catch(e){ok=false;}
  if(!ok){
    alert(tr("Не вдалося показати рекламу. Спробуй пізніше.","Ad couldn't be shown. Try again later."));
    renderAdRewardOptions();
    return;
  }
  const s=adRewardState();
  s.usedToday+=1;
  s.history[reward.key]=day;
  try{reward.apply();}catch(e){console.warn("[CG] reward apply failed:",e);}
  saveGame(false);
  render();
  closeAdRewardModal();
}
// ============================================================================
function nextWeek(){
  if(playerLevel()<5){log("❌ Наступний тиждень відкривається з 5 рівня героя.","system");render();return;}
  const start=day;
  for(let i=0;i<7;i++) advanceDay(false,false);
  log("⏩ Пропущено тиждень: день "+start+" → день "+day+".","system",true);
  showDaySummary(day-1,[{day:day-1,type:"system",text:"Минув тиждень управління торговим домом. Перевір журнал, доходи, платню, їжу та завдання."}]);
  saveGame(false);
  render();
}
function closeEvent(){document.getElementById("eventModal").classList.add("hidden");}
// === v0.43: Artistic day summary ===
const DAY_OPENINGS={
  spring:[
    "Тіні весняного вечора подовжуються над {city}, день {n} літа Господнього 1205 згортається у спогад.",
    "Хмільний запах вологої землі повис над {city} — день {n} цього року добіг своєї межі.",
    "Молода зелень {city} вже випила сонце, і {n}-й день огортається бузковими сутінками."
  ],
  summer:[
    "Гаряче літнє повітря тремтить над дахами {city}; день {n} лягає золотим попелом у пам'ять.",
    "Сонце скочується за стіни {city}, лишаючи на бруківці теплий відблиск {n}-го дня.",
    "Ще довго не змеркне над {city}, та {n}-й день уже відлічено в книгу літ."
  ],
  autumn:[
    "Тихий шелест опалого листя проводжає {n}-й день у {city}; осінь не питає дозволу.",
    "Темні хмари нависають над {city}, і {n}-й день блякне у вогкому повітрі.",
    "Над {city} простягається жовте полум'я лип — день {n} цього року догорає разом з ними."
  ],
  winter:[
    "Сніг лягає товстою попоною на дахи {city}, заглушуючи галас {n}-го дня.",
    "Морозне дихання здіймається над {city} — день {n} цього року звужується до кола свічки.",
    "У сизих сутінках {city} лиш кроки сторожі рахують останні години {n}-го дня."
  ]
};
const DAY_OPENINGS_EN={
  spring:[
    "The shadows of a spring evening lengthen over {city}; day {n} of the Year of Our Lord 1205 folds itself into memory.",
    "A heady scent of damp earth hangs over {city} — day {n} of this year has reached its end.",
    "The young green of {city} has drunk its fill of sun, and day {n} draws on its lilac twilight."
  ],
  summer:[
    "Hot summer air trembles above the rooftops of {city}; day {n} settles like golden ash into memory.",
    "The sun rolls behind the walls of {city}, leaving a warm reflection of day {n} on the cobbles.",
    "It will not grow dark over {city} for a long while yet, but day {n} is already counted in the book of years."
  ],
  autumn:[
    "The quiet rustle of fallen leaves sees day {n} off in {city}; autumn does not ask permission.",
    "Dark clouds hang over {city}, and day {n} fades in the damp air.",
    "Above {city} stretches the yellow flame of lindens — day {n} of this year burns out with them."
  ],
  winter:[
    "Snow lays a thick mantle on the rooftops of {city}, muffling the clamor of day {n}.",
    "Frosty breath rises above {city} — day {n} of this year narrows to the circle of a candle.",
    "In the grey twilight of {city}, only the footsteps of the watch count the last hours of day {n}."
  ]
};
const DAY_CLOSINGS={
  rich:["Скарбниця повна, і сон сьогодні буде солодким.","Дзвін монет ще довго бринітиме в думках. Можна спати спокійно.","З легким серцем торговець відкладає рахункові кістки до завтра."],
  modest:["Завтрашній день покаже, чи треба буде затягувати пояс тугіше.","Не золотий день, та й не порожній — і це вже благо.","Свіча догорає, як і сили торговця: завтра все спочатку."],
  poor:["Грошей лишилось обмаль; ніч буде довгою.","Серце стискає тривога: чим завтра годуватиметься дім?","У темряві кімнати чути лише шарудіння павучих лап і тяжкі думки про борги."],
  weary:["Втома дзвенить у скронях — день вибрав з торговця всі сили.","Кожна жилка молить про відпочинок: сьогодні забагато справ зробилося.","Очі злипаються самі — все інше може почекати до ранку."],
  fresh:["Сили ще є, та потрібно ощадити їх до завтрашніх клопотів.","Голова свіжа, ноги ще міцні — можна було б ще працювати, але час чесний.","Спокійна ніч прийде сама собою — день минув без надмірних випробувань."]
};
const DAY_CLOSINGS_EN={
  rich:["The treasury is full, and sleep tonight will be sweet.","The ring of coins will linger in your thoughts. You may sleep at ease.","With a light heart the merchant sets aside his counting bones until tomorrow."],
  modest:["Tomorrow will show whether the belt must be tightened.","Not a golden day, but not an empty one — and that is already a blessing.","The candle burns down, as do the merchant's strength: tomorrow it all begins anew."],
  poor:["Little coin remains; the night will be long.","Anxiety grips the heart: with what shall the house be fed tomorrow?","In the darkness of the room only the scuttle of spider feet and heavy thoughts of debt can be heard."],
  weary:["Weariness rings in the temples — the day has drawn out all the merchant's strength.","Every fiber begs for rest: too much was done today.","Eyelids close on their own — everything else can wait till morning."],
  fresh:["Strength remains, but it must be saved for tomorrow's troubles.","The head is clear, the legs still strong — one could work on, but the hour is honest.","A quiet night will come of its own — the day passed without excessive trials."]
};
function pickN(arr){return arr[Math.floor(Math.random()*arr.length)];}
function dayOpeningProse(completedDay){
  const sKey=currentSeason().key;
  const src=lang==="en"?DAY_OPENINGS_EN:DAY_OPENINGS;
  const list=src[sKey]||src.spring;
  return pickN(list).replace("{n}",completedDay).replace("{city}",`<b>${escapeHtml(cityName(currentCity))}</b>`);
}
function dayClosingProse(){
  let bucket;
  if(gold>3000) bucket="rich";
  else if(gold<200) bucket="poor";
  else bucket="modest";
  const src=lang==="en"?DAY_CLOSINGS_EN:DAY_CLOSINGS;
  const tired=energy<=2?pickN(src.weary):pickN(src.fresh);
  return `<em>${pickN(src[bucket])} ${tired}</em>`;
}
function narrateDayGroup(title,icon,entries,prose){
  if(!entries.length) return "";
  const list=entries.map(e=>`<li>${escapeHtml(e.text)}</li>`).join("");
  return `<div class="day-prose-block"><h4>${icon} ${escapeHtml(title)}</h4><p class="day-prose-text">${prose}</p><ul class="day-prose-list">${list}</ul></div>`;
}
function narrateDaySummary(completedDay,entries){
  const empty=tr(
    "Жодна суттєва подія не залишила сліду в пам'яті цього дня — лише дзвони далекої церкви та тихий гомін міста.",
    "No significant event left a mark on the memory of this day — only the bells of a distant church and the quiet hum of the city."
  );
  if(!entries||!entries.length){
    return `<div class="day-prose-shell"><p class="day-prose-opening">${dayOpeningProse(completedDay)}</p><p class="day-prose-text"><em>${empty}</em></p><p class="day-prose-closing">${dayClosingProse()}</p></div>`;
  }
  // Group by type
  const groups={market:[],shop:[],travel:[],caravan:[],danger:[],hq:[],quest:[],relation:[],family:[],people:[],achievement:[],system:[]};
  entries.forEach(e=>{
    const k=e.type||"system";
    if(groups[k]) groups[k].push(e); else groups.system.push(e);
  });
  const cityB=`<b>${cityName(currentCity)}</b>`;
  const traderEntries=[...groups.market,...groups.shop];
  const traderProse=traderEntries.length?tr(
    `На ринку та в крамницях ${cityB} сьогодні точилася звичайна купецька торгівля: чулися перемовини, дзвеніли монети, мінялися товари — і кожна угода додавала рядка до книги торгового дому.`,
    `On the market and in the shops of ${cityB} the usual merchant trade went on today: voices haggled, coins rang, goods changed hands — and every deal added a line to the trading house ledger.`):"";
  const travelProse=(groups.travel.length||groups.caravan.length)?tr(
    `Дороги виплюнули свої таємниці: пил, ризик і нагороду. У дорожніх щоденниках з'явилися нові рядки про мита, зустрічі та небезпеки.`,
    `The roads gave up their secrets: dust, risk and reward. New lines appeared in the travel journals — tolls, meetings, dangers.`):"";
  const combatProse=groups.danger.length?tr(
    `Не обійшлося без крику сталі: десь у дорозі чи на околиці зчинилася сутичка, що залишила криваві сліди й гірку пам'ять.`,
    `It did not pass without the cry of steel: somewhere on the road or at the city edge a skirmish broke out, leaving bloody traces and bitter memory.`):"";
  const hqProse=groups.hq.length?tr(
    `Штаб торгового дому дихав звичним ритмом: майстерні стукотіли молотами, кухня курила димом, а підлеглі звітували про зроблене.`,
    `The trading house headquarters breathed at its usual pace: workshops hammered, the kitchen smoked, and retainers reported their work.`):"";
  const questProse=groups.quest.length?tr(
    `Гільдія й рада міста занотували нові кроки на шляху завдань — то очікувана послуга, то новий контракт.`,
    `The guild and the city council noted new steps along the path of quests — an expected service, a new contract.`):"";
  const relationProse=(groups.relation.length||groups.family.length)?tr(
    `Серед підлеглих не все вирішують монети: сьогодні промайнули погляди, слова, обіцянки — і зв'язки між людьми стали або міцнішими, або тоншими.`,
    `Among the retainers not everything is decided by coin: today glances, words, promises flashed past — and the bonds between people grew either stronger or thinner.`):"";
  const peopleProse=groups.people.length?tr(
    `На вулицях зустрілися нові обличчя: хтось шукав місця, хтось — нової господи.`,
    `New faces met in the streets: some looking for a place, others — for a new household.`):"";
  const achieveProse=groups.achievement.length?tr(
    `<b style="color:var(--quality-legendary)">⭐ Доля визнала твої зусилля</b> — у літописі торгового дому з'явився новий запис, який пам'ятатимуть.`,
    `<b style="color:var(--quality-legendary)">⭐ Fate has acknowledged your effort</b> — a new line appeared in the chronicle of the trading house, one that will be remembered.`):"";
  const systemProse=groups.system.length?tr(
    `Між інших клопотів день розпорошив дрібні нотатки — про витрати, події, переходи часу.`,
    `Amid other cares the day scattered small notes — expenses, events, the passing of time.`):"";

  let html=`<div class="day-prose-shell"><p class="day-prose-opening">${dayOpeningProse(completedDay)}</p>`;
  html+=narrateDayGroup(tr("Торгівля","Trade"),"🪙",traderEntries,traderProse);
  html+=narrateDayGroup(tr("Дороги","Roads"),"🧭",[...groups.travel,...groups.caravan],travelProse);
  html+=narrateDayGroup(tr("Сталь і кров","Steel & blood"),"⚔️",groups.danger,combatProse);
  html+=narrateDayGroup(tr("Штаб","Headquarters"),"🏰",groups.hq,hqProse);
  html+=narrateDayGroup(tr("Завдання","Quests"),"📜",groups.quest,questProse);
  html+=narrateDayGroup(tr("Люди й стосунки","People & bonds"),"💞",[...groups.relation,...groups.family],relationProse);
  html+=narrateDayGroup(tr("Прибульці","Newcomers"),"👥",groups.people,peopleProse);
  html+=narrateDayGroup(tr("Здобутки","Achievements"),"🏆",groups.achievement,achieveProse);
  html+=narrateDayGroup(tr("Дрібниці дня","Sundries"),"✒️",groups.system,systemProse);
  html+=`<p class="day-prose-closing">${dayClosingProse()}</p></div>`;
  return html;
}

function showDaySummary(completedDay,entries){
  const s=currentSeason();
  const seasonName=lang==="en"?s.nameEn:s.name;
  document.getElementById("daySummaryTitle").innerHTML=tr(`📜 Літопис дня ${completedDay}`,`📜 Chronicle of day ${completedDay}`);
  document.getElementById("daySummaryText").innerHTML=tr(
    `Сили відновлено: <b>${dailyActionLimit()}</b> дій доступно на день ${day}. ${s.icon} <b>${seasonName}</b>.`,
    `Strength restored: <b>${dailyActionLimit()}</b> actions available for day ${day}. ${s.icon} <b>${seasonName}</b>.`
  );
  document.getElementById("daySummaryEntries").innerHTML=narrateDaySummary(completedDay,entries);
  document.getElementById("daySummaryModal").classList.remove("hidden");
}
function closeDaySummary(){document.getElementById("daySummaryModal").classList.add("hidden");}

function upgradeCost(room){return room.level*room.level*120;}
function buildRoom(key){
  const room=roomByKey(key);
  if(!room || room.unlocked) return;
  if(!requireHeadquartersPresence()) return;
  if(gold<room.buildCost){log("❌ Для відновлення «"+room.name+"» потрібно "+room.buildCost+" монет.","system");render();return;}
  if(!consumeAction("будівництво штабу")) return;
  gold-=room.buildCost;
  room.unlocked=true;
  checkRoomAchievements();
  gainExperience(12,"розбудову штабу");
  logAction("🏗️ Відкрито приміщення штабу: "+room.name+" за "+room.buildCost+" монет.","hq");
  saveGame(false);
  render();
}
function restoreHousePart(part){
  const house=roomByKey("house");
  const cost=part==="kitchen"?140:220;
  const field=part==="kitchen"?"kitchenRestored":"familyWingRestored";
  const name=part==="kitchen"?"Кухню":"Сімейні кімнати";
  if(house[field]) return;
  if(!requireHeadquartersPresence()) return;
  if(gold<cost){log("❌ Для відновлення потрібно "+cost+" монет.","system");render();return;}
  if(!consumeAction("відновлення дому")) return;
  gold-=cost;
  house[field]=true;
  gainExperience(8,"відновлення дому");
  logAction("🏠 "+name+" у Домі торговця відновлено за "+cost+" монет.","hq");
  saveGame(false);
  render();
}
const workshopRecipes = {
  forge:{
    "Інструменти":{resources:{"Залізо":1}},
    "Зброя":{resources:{"Залізо":2}},
    "Обладунки":{resources:{"Залізо":3,"Шкіра":1}}
  },
  weaving:{
    "Килими":{either:[["Вовна",2],["Льон",2]]},
    "Одяг":{resources:{"Льон":2}},
    "Сумки":{resources:{"Шкіра":2}},
    "Шапки":{resources:{"Вовна":1}}
  },
  jewelry:{
    "Прикраси":{either:[["Срібло",1],["Скло",2]]}
  },
  furniture:{
    "Меблі":{resources:{"Інструменти":1,"Шкіра":1}}
  }
};
function recipeMaterials(recipe){
  if(!recipe) return null;
  if(recipe.either){
    const selected=recipe.either.find(([name,qty])=>inventoryCount(name)>=qty);
    return selected?[selected]:null;
  }
  const required=Object.entries(recipe.resources||{});
  return required.every(([name,qty])=>inventoryCount(name)>=qty)?required:null;
}
function manufactureWorkshopProduct(key,product,person){
  const recipe=workshopRecipes[key]&&workshopRecipes[key][product];
  const materials=recipeMaterials(recipe);
  if(!materials) return null;
  materials.forEach(([name,qty])=>removeItem(name,qty));
  if(key==="forge" && (product==="Зброя" || product==="Обладунки")){
    const id=product==="Зброя"?"iron_sword":"iron_armor";
    itemInventory[id]=itemStock(id)+1;
    if(person) person.goodsProduced+=1;
    return {amount:1,materials,itemId:id};
  }
  const amount=addWorkshopOutput(product,workshopYield(key));
  if(person) person.goodsProduced+=amount;
  else creditGoodsProduced(({forge:"Кузня",weaving:"Ткацький цех",jewelry:"Ювелірна майстерня",furniture:"Меблева майстерня"})[key]||key,amount);
  return {amount,materials};
}
function craftWorkshop(key,product){
  const room=roomByKey(key);
  const recipe=workshopRecipes[key]&&workshopRecipes[key][product];
  const job=({forge:"Кузня",weaving:"Ткацький цех",jewelry:"Ювелірна майстерня",furniture:"Меблева майстерня"})[key];
  if(!room || !room.unlocked || !recipe || !assignedStaff(job).length){log("❌ Для виробництва потрібні відкрите приміщення і призначений майстер.","system");render();return;}
  if(!requireHeadquartersPresence()) return;
  if(!recipeMaterials(recipe)){log("❌ Бракує сировини для виробництва.","system");render();return;}
  if(!consumeAction("виготовлення товару")) return;
  const master=assignedStaff(job).sort((a,b)=>b.craft-a.craft)[0];
  const production=manufactureWorkshopProduct(key,product,master);
  master.craft=clamp(master.craft+1+Math.floor(roomFurnitureBonus(room,"craft")/3),0,BALANCE.maxAttribute);
  const madeItem=production.itemId?itemById(production.itemId).name:production.amount+" × "+product;
  logAction((key==="forge"?"🔨 ":key==="weaving"?"🧵 ":key==="jewelry"?"💍 ":"🪑 ")+profileName(master)+" виготовляє "+madeItem+".","hq");
  saveGame(false);
  render();
}
function upgradeRoom(index){
  const room=rooms[index];
  if(!room.unlocked) return;
  if(!requireHeadquartersPresence()) return;
  const cost=upgradeCost(room);
  if(gold<cost){log("❌ Для покращення потрібно "+cost+" монет.");render();return;}
  if(!consumeAction("покращення приміщення")) return;
  gold-=cost;
  room.level++;
  gainExperience(8,"покращення приміщення");
  logAction("🏰 Покращено приміщення: "+room.name+" до рівня "+room.level+" за "+cost+".","hq");
  saveGame(false);
  render();
}
function requireWorker(job){
  return ownedPeople().some(person=>person.job===job);
}
function useRoom(key){
  const room=roomByKey(key);
  if(!room || !room.unlocked) return;
  if(!requireHeadquartersPresence()) return;
  if(roomActionsUsed[key]===day){log("❌ Цю дію вже виконано сьогодні.");render();return;}
  if(gold<room.cost){log("❌ Для дії потрібно "+room.cost+" монет.");render();return;}
  if(key==="warehouse" && !requireWorker("Склад")){
    log("❌ Для посилення охорони потрібен працівник на складі.");render();return;
  }
  if(key==="weaving" && (!assignedStaff("Ткацький цех").length || (inventoryCount("Вовна")<2 && inventoryCount("Льон")<2))){
    log("❌ Для ткацтва потрібен призначений працівник і 2 вовни або льону.");render();return;
  }
  if(key==="forge" && (!assignedStaff("Кузня").length || inventoryCount("Залізо")<1)){
    log("❌ Для кузні потрібен призначений працівник і 1 залізо.");render();return;
  }
  if(key==="jewelry" && (!assignedStaff("Ювелірна майстерня").length || (inventoryCount("Срібло")<1 && inventoryCount("Скло")<2))){
    log("❌ Для ювелірної майстерні потрібен майстер і срібло або 2 скла.");render();return;
  }
  if(key==="furniture" && (!assignedStaff("Меблева майстерня").length || inventoryCount("Інструменти")<1 || inventoryCount("Шкіра")<1)){
    log("❌ Для меблевої майстерні потрібен столяр, інструменти і шкіра.");render();return;
  }
  if(key==="stable" && !assignedStaff("Ферма").length){
    log("❌ Для роботи ферми потрібен призначений фермер.");render();return;
  }
  if(key==="house" && (!room.kitchenRestored || !assignedStaff("Кухня").length || inventoryCount("Зерно")<1)){
    log("❌ Для пайків потрібен кухар і 1 одиниця зерна.");render();return;
  }
  if(key==="training" && !assignedStaff("Тренування").length){
    log("❌ Спершу признач працівника на тренування.");render();return;
  }
  if(key==="cells" && !ownedSlaves.length){
    log("❌ Камери порожні.");render();return;
  }
  if(key==="inn" && !assignedStaff("Заїжджий двір").length){
    log("❌ Заїжджому двору потрібен вільний працівник, кріпак або громадянин.");render();return;
  }
  if(!consumeAction("дія у штабі")) return;
  gold-=room.cost;
  roomActionsUsed[key]=day;
  if(key==="house") removeItem("Зерно",1);
  if(key==="warehouse") securityUntil=day+3;
  if(key==="stable"){
    caravanBoostUntil=day+3;
    activeCaravans.forEach(c=>c.remaining=Math.max(1,c.remaining-1));
    const produced=farmFoodProduction(true);
    if(produced>0) log("🌾 Ферма дала додаткову їжу: +"+produced+".","hq");
  }
  if(key==="house") kitchenUntil=day+3;
  if(key==="training") ownedPeople().filter(person=>person.job==="Тренування").forEach(person=>person.combat=clamp(person.combat+room.level,0,BALANCE.maxAttribute));
  if(key==="weaving"){
    manufactureWorkshopProduct("weaving","Килими");
  }
  if(key==="forge"){
    manufactureWorkshopProduct("forge","Інструменти");
  }
  if(key==="jewelry") manufactureWorkshopProduct("jewelry","Прикраси");
  if(key==="furniture") manufactureWorkshopProduct("furniture","Меблі");
  if(key==="cells") ownedSlaves.forEach(person=>{person.obedience=clamp(person.obedience+room.level+roomFurnitureBonus(room,"security"),0,BALANCE.maxAttribute);person.loyalty=clamp(person.loyalty-1,0,BALANCE.maxAttribute);});
  if(key==="inn"){
    assignedStaff("Заїжджий двір").forEach(person=>person.loyalty=clamp(person.loyalty+1,0,BALANCE.maxAttribute));
    adjustReputation(1);
  }
  logAction("🏰 Виконано дію «"+room.action+"» у приміщенні "+room.name+" за "+room.cost+" монет.","hq");
  saveGame(false);
  render();
}
function log(text,type="system",playerAction=false){
  const entry={day,text,type};
  journal.unshift(entry);
  journal=journal.slice(0,BALANCE.journalLimit);
  if(Array.isArray(daySummary)) daySummary.push(entry);
  if(playerAction && player){
    player.history.unshift("День "+day+": "+text);
    player.history=player.history.slice(0,BALANCE.historyLimit);
  }
}

document.querySelectorAll(".nav").forEach(btn=>{btn.onclick=()=>{
  setActiveTab(btn.dataset.tab);
};});
// v0.43: track user-opened state for mobile collapsibles
document.addEventListener("toggle",function(e){
  if(e.target.matches("details.npc-actions-toggle")){
    if(e.target.open) e.target.dataset.userOpened="1";
    else delete e.target.dataset.userOpened;
  }
},true);

loadLang();
let _welcomeShown=false;
function chooseWelcomeLang(value){
  setLang(value);
  document.getElementById("welcomeModal").classList.add("hidden");
  _welcomeShown=false;
  unlockPageScroll();
  if(!player.created) showCharacterCreation();
  deferUnlockPageScroll();
}
function showWelcomeIfNew(){
  // Show welcome only on the first run (no language pre-set + no character)
  let hasLang=false;
  try{hasLang=!!localStorage.getItem(LANG_KEY);}catch(e){}
  if(hasLang) return false;
  if(player.created) return false;
  _welcomeShown=true;
  const el=document.getElementById("welcomeModal");
  if(!el) return false;
  el.classList.remove("hidden");
  return true;
}
// v0.43: tell CrazyGames we're loading
CG.loadingStart();
if(!loadGame()){
  startNewState();
  log("🎮 Білд v0.43 запущено. Створіть героя, оберіть стартове місто і розпочніть шлях у 1205 році.","system",true);
  saveGame(false);
}else{
  saveGame(false);
}
applyStaticI18n();
render();
// v0.43: collapsible UI
applySavedCollapsedUI();
bindCollapseTapHandlers();
// v0.43: loading complete; start gameplay tracking once a hero exists
CG.loadingStop();
if(showWelcomeIfNew()){
  // wait for chooseWelcomeLang to handle creation
}else if(!player.created){
  showCharacterCreation();
}else{
  CG.gameplayStart();
}
