 module.exports = require ('../models')('Organization', {
    _addedBy         : { type: String, default:null },
    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    tags             : [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
    code             : { type: String, trim: true, default: ''},
    name             : { type: String, trim: true }
});
