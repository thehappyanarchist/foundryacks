// Import Modules
import { AcksItemSheet } from "./module/item/item-sheet.js";
import { AcksActorSheetCharacter } from "./module/actor/character-sheet.js";
import { AcksActorSheetMonster } from "./module/actor/monster-sheet.js";
import { preloadHandlebarsTemplates } from "./module/preloadTemplates.js";
import { AcksActor } from "./module/actor/entity.js";
import { AcksItem } from "./module/item/entity.js";
import { ACKS } from "./module/config.js";
import { registerSettings } from "./module/settings.js";
import { registerHelpers } from "./module/helpers.js";
import * as chat from "./module/chat.js";
import * as treasure from "./module/treasure.js";
import * as macros from "./module/macros.js";
import * as party from "./module/party.js";
import { AcksCombat } from "./module/combat.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d6 + @initiative.value",
    decimals: 0,
  };

  CONFIG.ACKS = ACKS;

  game.acks = {
    rollItemMacro: macros.rollItemMacro,
  };

  // Custom Handlebars helpers
  registerHelpers();

  // Register custom system settings
  registerSettings();

  CONFIG.Actor.entityClass = AcksActor;
  CONFIG.Item.entityClass = AcksItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("acks", AcksActorSheetCharacter, {
    types: ["character"],
    makeDefault: true,
  });
  Actors.registerSheet("acks", AcksActorSheetMonster, {
    types: ["monster"],
    makeDefault: true,
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("acks", AcksItemSheet, { makeDefault: true });

  await preloadHandlebarsTemplates();
});

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = ["saves_short", "saves_long", "scores", "armor", "colors", "tags"];
  for (let o of toLocalize) {
    CONFIG.ACKS[o] = Object.entries(CONFIG.ACKS[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }
});

Hooks.once("ready", async () => {
  Hooks.on("hotbarDrop", (bar, data, slot) =>
    macros.createAcksMacro(data, slot)
  );

  game.combats.combats.forEach(combat => {
    AcksCombat.setSortCombatantsMethod(combat);
  })
});

// License and KOFI infos
Hooks.on("renderSidebarTab", async (object, html) => {
  if (object instanceof ActorDirectory) {
    party.addControl(object, html);
  }
});

Hooks.on("preCreateCombatant", (combat, data, options, id) => {
  let init = game.settings.get("acks", "initiative");
  if (init == "group") {
    AcksCombat.addCombatant(combat, data, options, id);
  }
});

Hooks.on("preUpdateCombatant", AcksCombat.updateCombatant);
Hooks.on("renderCombatTracker", AcksCombat.format);
Hooks.on("preUpdateCombat", AcksCombat.preUpdateCombat);
Hooks.on("getCombatTrackerEntryContext", AcksCombat.addContextEntry);

Hooks.on("renderChatLog", (app, html, data) => AcksItem.chatListeners(html));
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessage", chat.addChatMessageButtons);
Hooks.on("renderRollTableConfig", treasure.augmentTable);
Hooks.on("updateActor", party.update);
