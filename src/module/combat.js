export class AcksCombat {
  static rollInitiative(combat, data) {
    // Check groups
    data.combatants = [];
    let groups = {};
    combat.data.combatants.forEach((cbt) => {
      groups[cbt.flags.acks.group] = { present: true };
      data.combatants.push(cbt);
    });

    // Roll init
    Object.keys(groups).forEach((group) => {
      let roll = new Roll("1d6").roll();
      roll.toMessage({
        flavor: game.i18n.format('ACKS.roll.initiative', { group: CONFIG["ACKS"].colors[group] }),
      });
      groups[group].initiative = roll.total;
    });

    // Set init
    for (let i = 0; i < data.combatants.length; ++i) {
      if (!data.combatants[i].actor) {
        return;
      }
      data.combatants[i].initiative =
      groups[data.combatants[i].flags.acks.group].initiative;
      if (data.combatants[i].actor.data.data.isSlow) {
        data.combatants[i].initiative -= 1;
      }      
    }
    combat.setupTurns();
  }

  static async resetInitiative(combat, data) {
    let reroll = game.settings.get("acks", "initiative");
    if (!["reset", "reroll"].includes(reroll)) {
      return;
    }
    combat.resetAll();
  }

  static async individualInitiative(combat, data) {
    let updates = [];
    let messages = [];
    combat.data.combatants.forEach((c, i) => {
      // This comes from foundry.js, had to remove the update turns thing
      // Roll initiative
      const cf = combat._getInitiativeFormula(c);
      const roll = combat._getInitiativeRoll(c, cf);
      let value = roll.total;
      if (combat.settings.skipDefeated && c.defeated) {
        value = -790;
      }
      updates.push({ _id: c._id, initiative: value });

      // Determine the roll mode
      let rollMode = game.settings.get("core", "rollMode");
      if ((c.token.hidden || c.hidden) && (rollMode === "roll")) rollMode = "gmroll";

      // Construct chat message data
      let messageData = mergeObject({
        speaker: {
          scene: canvas.scene._id,
          actor: c.actor ? c.actor._id : null,
          token: c.token._id,
          alias: c.token.name
        },
        flavor: game.i18n.format('ACKS.roll.individualInit', { name: c.token.name })
      }, {});
      const chatData = roll.toMessage(messageData, { rollMode, create: false });

      if (i > 0) chatData.sound = null;   // Only play 1 sound for the whole set
      messages.push(chatData);
    });
    await combat.updateEmbeddedEntity("Combatant", updates);
    await CONFIG.ChatMessage.entityClass.create(messages);
    data.turn = 0;
  }

  static format(object, html, user) {
    html.find(".initiative").each((_, span) => {
      span.innerHTML =
        span.innerHTML == "-789.00"
          ? '<i class="fas fa-weight-hanging"></i>'
          : span.innerHTML;
      span.innerHTML =
        span.innerHTML == "-790.00"
          ? '<i class="fas fa-dizzy"></i>'
          : span.innerHTML;
    });
          
    html.find(".combatant").each((_, ct) => {
      // Append spellcast and retreat
      const controls = $(ct).find(".combatant-controls .combatant-control");
      const cmbtant = object.combat.getCombatant(ct.dataset.combatantId);
      const moveActive = cmbtant.flags.acks && cmbtant.flags.acks.moveInCombat ? "active" : "";
      controls.eq(1).after(
        `<a class='combatant-control move-combat ${moveActive}'><i class='fas fa-running'></i></a>`
      );
      const spellActive = cmbtant.flags.acks && cmbtant.flags.acks.prepareSpell ? "active" : "";
      controls.eq(1).after(
        `<a class='combatant-control prepare-spell ${spellActive}'><i class='fas fa-magic'></i></a>`
      );
      const holdActive = cmbtant.flags.acks && cmbtant.flags.acks.holdTurn ? "active" : "";
      controls.eq(1).after(
        `<a class='combatant-control hold-turn ${holdActive}'><i class='fas fa-pause-circle'></i></a>`
      );
    });
    AcksCombat.announceListener(html);

    let init = game.settings.get("acks", "initiative") === "group";
    if (!init) {
      return;
    }

    html.find('.combat-control[data-control="rollNPC"]').remove();
    html.find('.combat-control[data-control="rollAll"]').remove();
    let trash = html.find(
      '.encounters .combat-control[data-control="endCombat"]'
    );
    $(
      '<a class="combat-control" data-control="reroll"><i class="fas fa-dice"></i></a>'
    ).insertBefore(trash);

    html.find(".combatant").each((_, ct) => {
      // Can't roll individual inits
      $(ct).find(".roll").remove();

      // Get group color
      const cmbtant = object.combat.getCombatant(ct.dataset.combatantId);
      let color = cmbtant.flags.acks.group;

      // Append colored flag
      let controls = $(ct).find(".combatant-controls");
      controls.prepend(
        `<a class='combatant-control flag' style='color:${color}' title="${CONFIG.ACKS.colors[color]}"><i class='fas fa-flag'></i></a>`
      );
    });
    AcksCombat.addListeners(html);
  }

  static updateCombatant(combat, combatant, data) {
    let init = game.settings.get("acks", "initiative");
    // Why do you reroll ?
// Legacy Slowness code from OSE
//    if (combatant.actor.data.data.isSlow) {
//      data.initiative = -789;
//      return;
//    }
    if (data.initiative && init == "group") {
      let groupInit = data.initiative;
      // Check if there are any members of the group with init
      combat.combatants.forEach((ct) => {
        if (
          ct.initiative &&
          ct.initiative != "-789.00" &&
          ct._id != data._id &&
          ct.flags.acks.group == combatant.flags.acks.group
        ) {
          groupInit = ct.initiative;
          // Set init
          data.initiative = parseInt(groupInit);
        }
      });
    }
  }

  static announceListener(html) {
    html.find(".combatant-control.hold-turn").click((ev) => {
      ev.preventDefault();
      // Toggle hold announcement
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      let isActive = ev.currentTarget.classList.contains('active');
      game.combat.updateCombatant({
        _id: id,
        flags: { acks: { holdTurn: !isActive } },
      });
    })
    html.find(".combatant-control.prepare-spell").click((ev) => {
      ev.preventDefault();
      // Toggle spell announcement
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      let isActive = ev.currentTarget.classList.contains('active');
      game.combat.updateCombatant({
        _id: id,
        flags: { acks: { prepareSpell: !isActive } },
      });
    });
    html.find(".combatant-control.move-combat").click((ev) => {
      ev.preventDefault();
      // Toggle retreat announcement
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      let isActive = ev.currentTarget.classList.contains('active');
      game.combat.updateCombatant({
        _id: id,
        flags: { acks: { moveInCombat: !isActive } },
      });
    });
  }

  static addListeners(html) {
    // Cycle through colors
    html.find(".combatant-control.flag").click((ev) => {
      if (!game.user.isGM) {
        return;
      }
      let currentColor = ev.currentTarget.style.color;
      let colors = Object.keys(CONFIG.ACKS.colors);
      let index = colors.indexOf(currentColor);
      if (index + 1 == colors.length) {
        index = 0;
      } else {
        index++;
      }
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      game.combat.updateCombatant({
        _id: id,
        flags: { acks: { group: colors[index] } },
      });
    });

    html.find('.combat-control[data-control="reroll"]').click((ev) => {
      if (!game.combat) {
        return;
      }
      let data = {};
      AcksCombat.rollInitiative(game.combat, data);
      game.combat.update({ data: data }).then(() => {
        game.combat.setupTurns();
      });
    });
  }

  static addCombatant(combat, data, options, id) {
    let token = canvas.tokens.get(data.tokenId);
    let color = "black";
    switch (token.data.disposition) {
      case -1:
        color = "red";
        break;
      case 0:
        color = "yellow";
        break;
      case 1:
        color = "green";
        break;
    }
    data.flags = {
      acks: {
        group: color,
      },
    };
  }
  static activateCombatant(li) {
    const turn = game.combat.turns.findIndex(turn => turn._id === li.data('combatant-id'));
    game.combat.update({turn: turn})
  }

  static addContextEntry(html, options) {
    options.unshift({
      name: "Set Active",
      icon: '<i class="fas fa-star-of-life"></i>',
      callback: AcksCombat.activateCombatant
    });
  }

  static async preUpdateCombat(combat, data, diff, id) {
    let init = game.settings.get("acks", "initiative");
    let reroll = game.settings.get("acks", "initiative");
    if (!data.round) {
      return;
    }
    if (data.round !== 1) {
      if (reroll === "reset") {
        AcksCombat.resetInitiative(combat, data, diff, id);
        return;
      } else if (reroll === "keep") {
        return;
      }
    }
    if (init === "group") {
      AcksCombat.rollInitiative(combat, data, diff, id);
    } else if (init === "individual") {
      AcksCombat.individualInitiative(combat, data, diff, id);
    }
    AcksCombat.setSortCombatantsMethod(combat);
  }

  static setSortCombatantsMethod(combat, setting) {
    setting = setting || game.settings.get("acks", "initiativeBreaker");

    if (setting === 'random') {
      combat._sortCombatants = AcksCombat.sortCombatantsRandom;
    } else {
      combat._sortCombatants = Combat.prototype._sortCombatants;
    }
  }


  static sortCombatantsRandom(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : -9999;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : -9999;

    a.initiativeBreaker = ia === -9999 ? null : a.initiativeBreaker || Math.random();
    b.initiativeBreaker = ib === -9999 ? null : b.initiativeBreaker || Math.random();

    let ci = ib - ia;
    if (ci !== 0) return ci;

    ci = a.initiativeBreaker - b.initiativeBreaker;
    if (ci !== 0) return ci;

    let [an, bn] = [a.token?.name || "", b.token?.name || ""];
    let cn = an.localeCompare(bn);
    if (cn !== 0) return cn;
    return a.tokenId - b.tokenId;
  }
}
