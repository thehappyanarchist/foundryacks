export const preloadHandlebarsTemplates = async function () {
    const templatePaths = [
        //Character Sheets
        'systems/acks/templates/actors/character-sheet.html',
        'systems/acks/templates/actors/monster-sheet.html',
        //Actor partials
        //Sheet tabs
        'systems/acks/templates/actors/partials/character-header.html',
        'systems/acks/templates/actors/partials/character-attributes-tab.html',
        'systems/acks/templates/actors/partials/character-abilities-tab.html',
        'systems/acks/templates/actors/partials/character-spells-tab.html',
        'systems/acks/templates/actors/partials/character-inventory-tab.html',
        'systems/acks/templates/actors/partials/character-notes-tab.html',

        'systems/acks/templates/actors/partials/monster-header.html',
        'systems/acks/templates/actors/partials/monster-attributes-tab.html'
    ];
    return loadTemplates(templatePaths);
};
