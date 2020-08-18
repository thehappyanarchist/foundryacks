// eslint-disable-next-line no-unused-vars
import { AcksActor } from '../actor/entity.js';

export class AcksCharacterModifiers extends FormApplication {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.classes = ["acks", "dialog", "modifiers"],
    options.id = 'sheet-modifiers';
    options.template =
      'systems/acks/templates/actors/dialogs/modifiers-dialog.html';
    options.width = 240;
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title() {
    return `${this.object.name}: Modifiers`;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    let data = this.object.data;
    data.user = game.user;
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
  }
}
