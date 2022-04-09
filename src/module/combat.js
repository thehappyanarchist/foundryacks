export class AcksCombat {
  static async rollInitiative(combat, data) {
    // Initialize groups.
    data.combatants = [];
    let groups = {};
    combat.data.combatants.forEach((cbt) => {
      groups[cbt.data.flags.acks.group] = {present: true};
      data.combatants.push(cbt);
    });

    // Roll initiative for each group.
    for (const group in groups) {
      const roll = new Roll("1d6");
      await roll.evaluate({async: true});
      await roll.toMessage({
        flavor: game.i18n.format('ACKS.roll.initiative', {
          group: CONFIG["ACKS"].colors[group],
        }),
      });

      groups[group].initiative = roll.total;
    }

    // Set the inititative for each group combatant.
    for (const combatant of data.combatants) {
      if (!combatant.actor) {
        return;
      }

      let initiative = groups[combatant.data.flags.acks.group].initiative;
      if (combatant.actor.data.data.isSlow) {
        initiative -= 1;
      }

      await combatant.update({
        initiative: initiative,
      });
    }

    combat.setupTurns();
  }

  static async resetInitiative(combat, data) {
    const reroll = game.settings.get("acks", "initiativePersistence");
    if (!["reset", "reroll"].includes(reroll)) {
      return;
    }

    combat.resetAll();
  }

  static async individualInitiative(combat, data) {
    const updates = [];
    const messages = [];

    let index = 0;

    for (const [id, combatant] of combat.data.combatants.entries()) {
      const roll = combatant.getInitiativeRoll();
      await roll.evaluate({async: true});
      let value = roll.total;

      if (combat.settings.skipDefeated && combatant.defeated) {
        value = -790;
      }

      updates.push({
        _id: id,
        initiative: value,
      });

      // Determine the roll mode
      let rollMode = game.settings.get("core", "rollMode");
      if ((combatant.token.hidden || combatant.hidden)
          && (rollMode === "roll")) {
        rollMode = "gmroll";
      }

      // Construct chat message data
      const messageData = mergeObject({
        speaker: {
          scene: canvas.scene._id,
          actor: combatant.actor?.id || null,
          token: combatant.token.id,
          alias: combatant.token.name
        },
        flavor: game.i18n.format('ACKS.roll.individualInit', {
          name: combatant.token.name,
        }),
      }, {});

      const chatData = await roll.toMessage(messageData, {
        rollMode,
        create: false,
      });

      // Only play one sound for the whole set.
      if (index > 0) {
        chatData.sound = null;
      }

      messages.push(chatData);

      ++index;
    }

    await combat.updateEmbeddedDocuments("Combatant", updates);
    await CONFIG.ChatMessage.documentClass.create(messages);

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
      const cmbtant = game.combat.combatants.get(ct.dataset.combatantId);
      const moveActive = cmbtant.data.flags.acks?.moveInCombat ? "active" : "";
      controls.eq(1).after(
        `<a class='combatant-control move-combat ${moveActive}'><i class='fas fa-running'></i></a>`
      );
      const spellActive = cmbtant.data.flags.acks?.prepareSpell ? "active" : "";
      controls.eq(1).after(
        `<a class='combatant-control prepare-spell ${spellActive}'><i class='fas fa-magic'></i></a>`
      );
      const holdActive = cmbtant.data.flags.acks?.holdTurn ? "active" : "";
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
      const combatant = object.viewed.combatants.get(ct.dataset.combatantId);
      let color = combatant.data.flags.acks?.group;

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
          ct.data.flags.acks.group == combatant.data.flags.acks.group
        ) {
          groupInit = ct.initiative;
          // Set init
          data.initiative = parseInt(groupInit);
        }
      });
    }
  }

  static announceListener(html) {
    html.find(".combatant-control.hold-turn").click(async (ev) => {
      ev.preventDefault();
      // Toggle hold announcement
      const id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      const isActive = ev.currentTarget.classList.contains('active');
      const combatant = game.combat.combatants.get(id);
      await combatant.update({
        _id: id,
        flags: { acks: { holdTurn: !isActive } },
      });
    })

    html.find(".combatant-control.prepare-spell").click(async (ev) => {
      ev.preventDefault();
      // Toggle spell announcement
      const id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      const isActive = ev.currentTarget.classList.contains('active');
      const combatant = game.combat.combatants.get(id);
      await combatant.update({
        _id: id,
        flags: { acks: { prepareSpell: !isActive } },
      });
    });

    html.find(".combatant-control.move-combat").click(async (ev) => {
      ev.preventDefault();
      // Toggle retreat announcement
      const id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      const isActive = ev.currentTarget.classList.contains('active');
      const combatant = game.combat.combatants.get(id);
      await combatant.update({
        _id: id,
        flags: { acks: { moveInCombat: !isActive } },
      });
    });
  }

  static addListeners(html) {
    // Cycle through colors
    html.find(".combatant-control.flag").click(async (ev) => {
      if (!game.user.isGM) {
        return;
      }
      const currentColor = ev.currentTarget.style.color;
      const colors = Object.keys(CONFIG.ACKS.colors);
      let index = colors.indexOf(currentColor);
      if (index + 1 == colors.length) {
        index = 0;
      } else {
        index++;
      }

      const id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      const combatant = game.combat.combatants.get(id);
      await combatant.update({
        _id: id,
        flags: {
          acks: {
            group: colors[index],
          },
        },
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

  static async addCombatant(combatant, options, userId) {
    let color = "black";
    switch (combatant.token.data.disposition) {
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

    await combatant.update({
      flags: {
        acks: {
          group: color,
        },
      },
    });
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
    let reroll = game.settings.get("acks", "initiativePersistence");
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
  }
}