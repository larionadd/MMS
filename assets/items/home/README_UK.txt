ПРЕДМЕТИ ДЛЯ КІМНАТ ШТАБУ v0.18

Іконки домашніх предметів додавайте в цю папку як PNG.
Базові назви вже зареєстрованих речей:
oak_bed.png, wood_table.png, clay_hearth.png, storage_chest.png,
forge_anvil.png, loom_frame.png, iron_locks.png, hay_manger.png,
silver_candlestand.png, master_toolrack.png, dyed_master_loom.png,
captains_saddle.png, table_of_concord.png, anvil_of_red_dawn.png,
loom_of_silk_road.png.

Новий предмет додається в масив homeItemCatalog у game.js.
Поля:
- id, name, price, img, icon, desc
- rarity: common (сірий), rare (синій), legendary (помаранчевий)
- slot: функціональний тип предмета, наприклад bed, table, tool або loom
- rooms: список приміщень, у яких предмет доречний
- effects: bonus до comfort, income, capacity, upkeep, security, routeSafety або craft

Легендарним предметам додайте loot:true, price:0 і lore. Їх не буде у продажу:
вони трапляються в подорожах або як прихована винагорода за складні завдання.

Приватні кімнати подружжя приймають лише ліжка, столи, освітлення та
меблі зберігання; кухонна піч туди не встановлюється.
