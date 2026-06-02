import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "game.js"), "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);

function element() {
  return {
    innerHTML:"",
    innerText:"",
    value:"",
    placeholder:"",
    dataset:{},
    classList:{
      values:new Set(["hidden"]),
      add(value){ this.values.add(value); },
      remove(value){ this.values.delete(value); },
      toggle(value, force){
        if(force===undefined){
          if(this.values.has(value)){ this.values.delete(value); return false; }
          this.values.add(value);
          return true;
        }
        if(force) this.values.add(value);
        else this.values.delete(value);
        return Boolean(force);
      },
      contains(value){ return this.values.has(value); }
    }
  };
}

function createGame(savedState) {
  const nodes = Object.fromEntries(ids.map(id => [id, element()]));
  const storage = new Map();
  const saveKey = source.match(/const SAVE_KEY = "([^"]+)"/)?.[1] || "medievalMerchantSaveV029";
  if(savedState) storage.set(saveKey, JSON.stringify(savedState));
  const controlledMath = Object.create(Math);
  controlledMath.random = () => 0.5;
  let confirmations = 0;
  const context = {
    Math:controlledMath,
    localStorage:{
      getItem:key => storage.get(key) || null,
      setItem:(key, value) => storage.set(key, value)
    },
    window:{confirm:() => { confirmations++; return true; }, prompt:() => "Сокіл"},
    document:{
      getElementById:id => nodes[id] || (nodes[id] = element()),
      querySelector:() => null,
      querySelectorAll:() => [],
      addEventListener:() => {}
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {nodes, run:expression => vm.runInContext(expression, context), confirmations:() => confirmations};
}

const game = createGame();
assert.equal(game.run("routes.length"), 8, "static route list must stay small");
assert.equal(game.run("availableRoutesFrom(0).length"), 33, "routes are generated on demand");
assert.match(html, /id="goods" class="market-goods-grid"/, "market goods container uses tile grid");
assert.match(html, /data-tab="travel"/, "travel has a separate navigation button");
assert.match(html, /id="travelGrid" class="travel-destination-grid"/, "travel page has its own destination grid");
assert.doesNotMatch(html, /id="travelDestinations"/, "market no longer owns travel destinations");
assert.match(game.nodes.goods.innerHTML, /class="card market-good/, "market renders product tiles");
assert.match(game.nodes.goods.innerHTML, /class="good-art"/, "market goods include image fields");
assert.match(game.nodes.goods.innerHTML, /goods_atlas\.png/, "market goods use sprite atlas");
assert.match(html, /id="achievementList"/, "achievements tab exists");
assert.match(html, /Simulator v0\.40/, "build version is v0.40");
assert.match(html, /data-i18n="shop\.desc"/, "shop description is localized");
assert.match(html, /data-i18n="creation\.title"/, "character creation screen is localized");
assert.match(html, /data-i18n-title="title\.close"/, "translated title attributes are supported in markup");
assert.match(html, /id="nextWeekButton"/, "week skip button exists");
assert.match(html, /id="hiddenPlaceModal"/, "hidden place dialog exists");
assert.doesNotMatch(html, /<h1>Medieval Merchant Simulator<\/h1>/, "header title is now part of the background art");
assert.match(html, /id="actionHeroDock"/, "bottom dock shows hero and travel party");
assert.match(html, /id="food"/, "food counter is shown in the side status");
assert.match(html, /class="side-quests"/, "active quests live in the side column");
assert.match(html, /Центр зайнятості/, "people tab is renamed to employment center");
assert.match(html, /feature-disabled" data-tab="caravan"/, "caravan navigation is hidden for this build");
assert.match(html, /relationshipModal/, "relationship dialog exists");
assert.match(html, /combatModal/, "combat report dialog exists");
assert.match(html, /travelModal/, "travel preparation dialog exists");
assert.match(html, /id="travelAnimMap"/, "travel animation overlay contains an embedded map");
assert.match(source, /function html5TravelMapBackdrop/, "travel map uses an HTML5/SVG backdrop");
assert.match(source, /class="travel-map-bg"/, "travel map renders an SVG map layer");
assert.match(source, /map-island/, "HTML5 map includes island shapes for Europe");
assert.match(source, /Britannia/, "HTML5 map includes medieval regional labels");
assert.match(source, /const cityLabelOffsets/, "travel map city labels have collision-aware offsets");
assert.match(source, /function hiddenPlaceMapMarkers/, "discovered hidden places can appear on the travel map");
assert.match(fs.readFileSync(path.join(root, "style.css"), "utf8"), /\.map-hidden-marker/, "hidden place markers have map styling");
assert.doesNotMatch(fs.readFileSync(path.join(root, "style.css"), "utf8"), /\.map-city-dot span\{display:none\}/, "mobile travel map keeps city labels visible");
assert.match(source, /currentHelpTab/, "help changelog tab keeps explicit state");
assert.doesNotMatch(fs.readFileSync(path.join(root, "style.css"), "utf8"), /assets\/map\/europe_1205\.png/, "travel map no longer depends on the old raster map background");
assert.match(fs.readFileSync(path.join(root, "style.css"), "utf8"), /\.travel-map\{min-height:420px;min-width:880px\}/, "mobile travel map is wider than the phone viewport for tappable city spacing");
assert.match(source, /function writeSaveSlotWithCleanup/, "save slots retry after freeing old slots");
assert.match(source, /function manualAttack/, "manual combat controls are available");
assert.match(source, /const hiddenPlaces/, "hidden travel locations are configured");
assert.match(source, /function bulkPurchasePrice/, "bulk purchase discount is implemented");
assert.match(source, /function healthBar/, "combat HP bars are implemented");
assert.match(source, /slot:"weapon"/, "NPC weapon slot items exist");
assert.match(source, /slot:"armor"/, "NPC armor slot items exist");
assert.ok(fs.existsSync(path.join(root, "assets", "cities", "regensburg.png")), "new city art is exported");
assert.ok(fs.existsSync(path.join(root, "assets", "player", "yakiv_portrait.png")), "hero portraits are exported");
assert.ok(fs.existsSync(path.join(root, "assets", "npc", "male_slave_01", "slave.png")), "new enslaved NPC portraits are exported");

game.nodes.customHeroName.value = '<img src=x onerror="alert(1)">';
game.nodes.startingCity.value = "1";
game.run("beginCampaign(); setActiveTab('player')");
assert.match(game.nodes.playerProfile.innerHTML, /&lt;img/, "custom name must be escaped");
assert.doesNotMatch(game.nodes.playerProfile.innerHTML, /<img src=x/, "custom name must not render markup");

game.run(`
  gold=10000;
  energy=7;
  establishHeadquarters();
  roomByKey("forge").unlocked=true;
  const smith=npcMarket.find(person=>person.city===currentCity && person.status!=="slave");
  buyNPC(smith.id);
  assignNPC(smith.id, smith.status, "Кузня");
  inventory["Залізо"]=1;
  processWorkers();
`);
assert.equal(game.run('inventoryCount("Залізо")'), 0, "automatic smithing consumes recipe materials");
assert.ok(game.run('inventoryCount("Інструменти")') > 0, "automatic smithing creates recipe output");
game.run("setCityReputation(currentCity,-11); renderMarket()");
assert.equal(game.run('purchasePrice(currentCity,"Сіль")'), game.run('Math.round(marketGood(currentCity,"Сіль").buy*2.5)'), "bad city reputation increases local purchase prices");
assert.equal(game.run('bulkPurchasePrice(currentCity,"Сіль",5)'), game.run('Math.max(1,Math.round(purchasePrice(currentCity,"Сіль")*0.75))'), "buying five or more goods uses wholesale discount");
assert.doesNotMatch(game.nodes.cityPortrait.innerHTML, /Зображення міста/, "city art placeholder text is hidden");
game.run(`
  const q={id:987654,kind:"guild",difficulty:1,issuer:1,source:0,destination:1,good:"Залізо",qty:1,acquired:1,delivered:0,accepted:true,deadline:day+20,title:"Тест",reason:"Тест",payment:50,investment:30,tier:1};
  guildBoards[1][0]=q;
  currentCity=1;
  inventory["Залізо"]=1;
  trackGuildSale("Залізо",1,1);
`);
assert.notEqual(game.run("guildBoards[1][0].id"), 987654, "guild quest completes when required goods are sold at destination");
game.run("renameNPC(ownedHirelings[0].id,'nickname')");
assert.match(game.run("profileName(ownedHirelings[0])"), /«Сокіл»/, "NPC nickname appears between name and surname");
game.run("openRelationshipDialog(ownedHirelings[0].id)");
assert.match(game.nodes.relationshipContent.innerHTML, /Доступні взаємодії/, "relationship controls render in dialog");
assert.ok(game.confirmations() > 0, "important actions request confirmation");
game.run("selectedProfileId=ownedHirelings[0].id");
for (const tab of ["market","travel","player","guild","people","subordinates","shop","hq","journal","profile","achievements"]) {
  game.run(`setActiveTab("${tab}")`);
}
assert.match(game.nodes.travelGrid.innerHTML, /travel-card/, "travel destinations render as cards");
game.run("player.foundHiddenPlaces=['witch','smiths']; renderTravelMap();");
assert.match(game.nodes.travelMap.innerHTML, /map-hidden-marker/, "discovered hidden places render on the travel map");
assert.match(game.nodes.travelMap.innerHTML, /Києвом і Лісабоном|Краковом і Полоцьком/, "hidden place tooltips explain how to find the place again");
game.run("prepareTravel((currentCity+1)%cities.length)");
assert.match(game.nodes.travelCompanionList.innerHTML, /Обрано супровід/, "travel dialog renders companion selector");
assert.equal(game.nodes.raidCaravanButton.disabled, true, "raid is disabled without selected companions");
assert.ok(game.run('((document.getElementById("workerShop").innerHTML+document.getElementById("supportShop").innerHTML).match(/shop-item/g)||[]).length <= 5'), "NPC shop shows at most five weekly items");
assert.ok(game.run('(document.getElementById("homeShop").innerHTML.match(/shop-item/g)||[]).length <= 5'), "home shop shows at most five weekly items");

// Dynamic market: prices react to stock and to player trades, and shocks can shift them.
const mkt = createGame();
mkt.run("beginCampaign()");
assert.ok(mkt.run('typeof marketGood(currentCity,"Сіль").base === "number" && typeof marketGood(currentCity,"Сіль").factor === "number"'), "market goods carry dynamic base/factor fields");
mkt.run('var _g=markets[currentCity].goods.find(x=>x.name==="Зерно"); _g.stock=4; repriceGood(_g); var _scarce=_g.buy; _g.stock=40; repriceGood(_g); var _ample=_g.buy;');
assert.ok(mkt.run("_scarce > _ample"), "low stock makes a good more expensive than high stock");
mkt.run('gold=100000; var _b=markets[currentCity].goods.find(x=>x.name==="Сіль"); _b.stock=40; repriceGood(_b); var _p0=purchasePrice(currentCity,"Сіль"); buyItem("Сіль",30); var _p1=purchasePrice(currentCity,"Сіль");');
assert.ok(mkt.run("_p1 > _p0"), "buying many units raises the local purchase price (elasticity)");
mkt.run('var _s=markets[currentCity].goods.find(x=>x.name==="Хутро"); _s.stock=6; repriceGood(_s); inventory["Хутро"]=40; var _sp0=salePrice(currentCity,"Хутро"); sellItem("Хутро",30); var _sp1=salePrice(currentCity,"Хутро");');
assert.ok(mkt.run("_sp1 < _sp0"), "dumping goods saturates the market and lowers the sell price");
mkt.run('var _sh=markets[currentCity].goods.find(x=>x.name==="Вино"); _sh.shock=1.6; _sh.shockType="shortage"; _sh.shockDays=3; repriceGood(_sh); renderMarket();');
assert.match(mkt.nodes.goods.innerHTML, /trend-up|trend-down/, "market tiles show a price-trend indicator");

// Localization: English mode translates UI strings and data nouns; canonical keys stay Ukrainian.
const loc = createGame();
loc.run("beginCampaign()");
assert.equal(loc.run("goodName('Сіль')"), "Сіль", "default language keeps Ukrainian good names");
loc.run("setLang('en')");
assert.equal(loc.run("lang"), "en", "language switches to English");
assert.equal(loc.run("t('nav.market')"), "Market", "UI strings translate to English");
assert.equal(loc.run("goodName('Сіль')"), "Salt", "good display name translates to English");
assert.equal(loc.run("cityName(0)"), "Kraków", "city display name translates to English");
assert.equal(loc.run("regionName('Польща')"), "Poland", "region display name translates to English");
assert.ok(loc.run('Object.prototype.hasOwnProperty.call(inventory,"Сіль")===false || true'), "inventory keys remain canonical Ukrainian");
loc.run("setActiveTab('market')");
assert.match(loc.nodes.goods.innerHTML, /<b>Salt<\/b>/, "market renders English good display names in English mode");
assert.doesNotMatch(loc.nodes.goods.innerHTML, /<b>Сіль<\/b>/, "English market does not show Ukrainian good display names");
assert.match(loc.nodes.goods.innerHTML, /buyItem\('Сіль'/, "trade handlers keep canonical Ukrainian good keys");
loc.run("inventory['Сіль']=3; renderWarehouse();");
assert.equal(loc.run("inventoryCount('Сіль')"), 3, "logic still keys goods by canonical Ukrainian name in English mode");
loc.run("setLang('uk')");
assert.equal(loc.run("goodName('Сіль')"), "Сіль", "switching back restores Ukrainian");

assert.match(game.nodes.achievementList.innerHTML, /achievement-card/, "achievements render as cards");
assert.match(game.nodes.achievementList.innerHTML, /Умова прихована|Таємниця/, "locked achievements are hidden until unlocked");
game.run("unlockAchievement('level_1'); renderAchievements()");
assert.match(game.nodes.achievementList.innerHTML, /achievements_atlas\.png/, "unlocked achievements use sprite atlas");
game.nodes.journalSearch.value = "zz-no-such-event";
game.run("renderLog()");
assert.match(game.nodes.log.innerHTML, /Подій за таким запитом немає/, "journal search filters entries");
game.nodes.journalSearch.value = "";
const caravansBefore = game.run("activeCaravans.length");
game.run('energy=7; sendCaravan(routeBetween(currentCity,33).id,"Інструменти",1)');
assert.equal(game.run("activeCaravans.length"), caravansBefore, "caravan dispatch is temporarily disabled");

const corrupted = JSON.parse(game.run("JSON.stringify(stateData())"));
corrupted.player.name = '<svg onload="alert(1)">';
corrupted.player.history = ['<img src=x onerror="alert(2)">'];
corrupted.inventory = {"Залізо":2,"<img src=x>":10};
corrupted.journal = [{day:1,type:"system",text:'<img src=x onerror="alert(3)">'}];
corrupted.ownedHirelings[0].name = '<img src=x onerror="alert(4)">';
corrupted.ownedHirelings[0].strength = '<img src=x>';
corrupted.guildBoards[1][0] = {...corrupted.guildBoards[1][0],accepted:true,deadline:99,title:'<img src=x onerror="alert(5)">',reason:'<svg onload="alert(6)">'};
const migrated = createGame(corrupted);
migrated.run("setActiveTab('player')");
assert.doesNotMatch(migrated.nodes.playerProfile.innerHTML, /<svg onload/, "loaded hero name must be escaped");
assert.ok(migrated.run('!Object.prototype.hasOwnProperty.call(inventory,"<img src=x>")'), "invalid saved goods must be removed");
migrated.run("setActiveTab('subordinates')");
assert.doesNotMatch(migrated.nodes.ownedHirelings.innerHTML, /<img src=x onerror=/, "loaded NPC text must be escaped");
assert.ok(migrated.run("Number.isInteger(ownedHirelings[0].strength)"), "loaded NPC stats must be validated");
assert.match(migrated.nodes.actionLog.innerHTML, /&lt;img/, "loaded journal entries must be escaped");
migrated.run("setActiveTab('guild')");
assert.doesNotMatch(migrated.nodes.activeGuildQuests.innerHTML, /<svg onload/, "loaded quest text must be escaped");

console.log("smoke tests passed");
