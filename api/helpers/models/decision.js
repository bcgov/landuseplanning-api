 module.exports = require ('../models')('Decision', {
    _addedBy         : { type:'ObjectId', ref:'User', default:null },
    _review          : { type:'ObjectId', ref:'Review', default:null },
    _application     : { type:'ObjectId', ref:'Application', default:null },
    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    tags             : [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
    code             : { type: String, trim: true, default: ''},
    name             : { type: String, trim: true },
    description      : { type: String, trim: true },
    isDeleted        : { type: Boolean, default: false }
});
