ПРЕДМЕТИ ДЛЯ MEDIEVAL MERCHANT SIMULATOR v0.15

Структура папок
---------------
assets/items/worker/   - іконки подарунків працівникам, кріпакам і громадянам
assets/items/support/  - іконки речей забезпечення для рабів
assets/items/legendary/ - іконки легендарних реліквій, знайдених у подорожах

Рівні якості
------------
common     - сірий, звичайні речі з вовни, дерева, каміння або шкіри
improved   - зелений, вироби із заліза, міді або олова
rare       - синій, речі зі срібла або золота
epic       - фіолетовий, платина, коштовні камені й золота інкрустація
legendary  - помаранчевий, унікальні реліквії з передісторією

У крамницях продаються предмети якості common, improved, rare та epic.
Конкретний асортимент залежить від міста: невеликі ринки продають простіші
речі, великі торгові центри можуть пропонувати предмети якості epic.
Предмети з каталогу також видаються як нагорода за замовлення гільдії та мерії.
Якість нагороди визначається орієнтовними витратами на товар і дорогу:
коротке недороге замовлення дає просту річ, а коштовна далека поставка може
винагородити фіолетовим предметом якості epic.
Предмети legendary трапляються з невеликою вірогідністю лише під час особистої
подорожі гравця між містами і можуть бути подаровані будь-якому NPC.

Рекомендований формат іконок
-----------------------------
- PNG із прозорим фоном
- Квадратне зображення, наприклад 256x256 або 512x512 px
- Назва файла латиницею малими літерами, без пробілів

Вбудовані предмети для працівників
----------------------------------
worker/wool_cloak.png       - Вовняний плащ
worker/fine_outfit.png      - Святкове вбрання
worker/silver_brooch.png    - Срібна брошка
worker/guild_ring.png       - Цеховий перстень
worker/traveler_charm.png   - Оберіг мандрівника
worker/artisan_token.png    - Знак ремісника
worker/golden_traveler_charm.png - Золотий оберіг мандрівника
worker/gold_inlaid_mantle.png    - Мантія із золотою інкрустацією
worker/platinum_seal.png         - Платинова печатка з аметистом

Вбудовані предмети забезпечення для рабів
-----------------------------------------
support/warm_tunic.png          - Тепла туніка
support/sturdy_boots.png        - Міцні черевики
support/wooden_beads.png        - Дерев'яне намисто
support/family_ribbon.png       - Пам'ятна стрічка
support/protective_amulet.png   - Захисний оберіг
support/hope_token.png          - Жетон надії
support/iron_clasp_coat.png     - Плащ із залізними застібками
support/silver_memory_medallion.png - Срібний медальйон пам'яті
support/platinum_amulet.png     - Платиновий оберіг з сапфіром
support/velvet_gold_coat.png    - Оксамитовий плащ із золотим шитвом

Вбудовані легендарні предмети
-----------------------------
legendary/mantle_of_yaroslav.png       - Мантія Ярославового посла
legendary/ring_of_the_last_forge.png   - Перстень Останньої кузні
legendary/star_road_reliquary.png      - Релікварій Зоряного шляху

Слоти
-----
У кожного NPC є рівно три слоти:

clothing  - Одяг
jewelry   - Прикраса
talisman  - Талісман

Новий предмет повинен мати один із цих slot.

Як додати новий предмет
-----------------------
1. Покладіть іконку в assets/items/worker/, assets/items/support/ або assets/items/legendary/.
2. Відкрийте game.js і знайдіть const itemCatalog = [ ... ].
3. Додайте новий об'єкт у масив.

Приклад подарунка для працівників:

{id:"gold_necklace",rarity:"rare",store:"worker",slot:"jewelry",name:"Золоте намисто",price:180,img:"assets/items/worker/gold_necklace.png",icon:"💎",desc:"Дорогий знак визнання.",effects:{loyalty:4,service:1}}

Приклад речі забезпечення:

{id:"winter_blanket",rarity:"common",store:"support",slot:"clothing",name:"Зимове покривало",price:55,img:"assets/items/support/winter_blanket.png",icon:"🧶",desc:"Допомагає пережити холодні ночі.",effects:{health:3,loyalty:2}}

Приклад легендарної знахідки:

{id:"crown_shard",rarity:"legendary",store:"any",slot:"talisman",name:"Уламок корони",price:0,loot:true,img:"assets/items/legendary/crown_shard.png",icon:"✨",desc:"Загублена реліквія.",lore:"Її шукають спадкоємці двох родів.",effects:{loyalty:9,craft:6}}

Поля предмета
-------------
id       - унікальний технічний ідентифікатор латиницею
rarity   - "common", "improved", "rare", "epic" або "legendary"
store    - "worker" для працівників або "support" для рабів
slot     - "clothing", "jewelry" або "talisman"
name     - назва, яку бачить гравець
price    - ціна в монетах
img      - шлях до PNG-іконки
icon     - запасна іконка, якщо PNG ще немає
desc     - короткий опис речі
effects  - характеристики, які зміняться під час екіпірування
loot     - true лише для легендарної речі, яку не можна купити, а можна знайти в дорозі
lore     - передісторія легендарного предмета, яка буде показана гравцеві

Підтримувані ефекти
-------------------
health     - здоров'я
loyalty    - лояльність
strength   - сила
craft      - ремесло
service    - гостинність
combat     - бій
obedience  - покірність

При заміні предмета старий предмет повертається в запас гравця,
а його бонуси знімаються з NPC.
