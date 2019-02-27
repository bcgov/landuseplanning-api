module.exports = require ('../models')('Vc', {
    description               : { type: String, trim: true, default: ''},
    name              : { type: String, trim: true, default: null},
    code                : { type: String, trim: true, default: ''},
    type                : { type: String, trim: true, default: ''},
    title                : { type: String, trim: true, default: ''},
    pillar                : { type: String, trim: true, default: ''},
    stage                : { type: String, trim: true, default: ''},
    // Permissions
    read                    : [[{ type: String, trim: true, default: '[["project-system-admin"]]' }]],
    write                   : [[{ type: String, trim: true, default: '[["project-system-admin"]]' }]],
    delete                  : [[{ type: String, trim: true, default: '[["project-system-admin"]]' }]]
});
