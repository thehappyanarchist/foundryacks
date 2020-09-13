export const registerSettings = function () {

  game.settings.register("acks", "initiative", {
    name: game.i18n.localize("ACKS.Setting.RerollInitiative"),
    hint: game.i18n.localize("ACKS.Setting.RerollInitiativeHint"),
    default: "reset",
    scope: "world",
    type: String,
    config: true,
    choices: {
      keep: "ACKS.Setting.InitiativeKeep",
      reset: "ACKS.Setting.InitiativeReset",
      reroll: "ACKS.Setting.InitiativeReroll",
    }
  });

  game.settings.register("acks", "ascendingAC", {
    name: game.i18n.localize("ACKS.Setting.AscendingAC"),
    hint: game.i18n.localize("ACKS.Setting.AscendingACHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    onChange: _ => window.location.reload()
  });

  game.settings.register("acks", "morale", {
    name: game.i18n.localize("ACKS.Setting.Morale"),
    hint: game.i18n.localize("ACKS.Setting.MoraleHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register("acks", "encumbranceOption", {
    name: game.i18n.localize("ACKS.Setting.Encumbrance"),
    hint: game.i18n.localize("ACKS.Setting.EncumbranceHint"),
    default: "detailed",
    scope: "world",
    type: String,
    config: true,
    choices: {
      disabled: "ACKS.Setting.EncumbranceDisabled",
      basic: "ACKS.Setting.EncumbranceBasic",
      detailed: "ACKS.Setting.EncumbranceDetailed",
      complete: "ACKS.Setting.EncumbranceComplete",
    },
    onChange: _ => window.location.reload()
  });

  game.settings.register("acks", "significantTreasure", {
    name: game.i18n.localize("ACKS.Setting.SignificantTreasure"),
    hint: game.i18n.localize("ACKS.Setting.SignificantTreasureHint"),
    default: 800,
    scope: "world",
    type: Number,
    config: true,
    onChange: _ => window.location.reload()
  });
};
