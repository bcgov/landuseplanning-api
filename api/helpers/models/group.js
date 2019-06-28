module.exports = require ('../models')('Group', {
    contact                 : { type:'ObjectId', ref:'User', default:null },
    project                 : { type:'ObjectId', ref:'Project', default:null },

    read             : [{ type: String, trim: true, default: '["sysadmin"]' }],
    write            : [{ type: String, trim: true, default: '["sysadmin"]' }],
    delete           : [{ type: String, trim: true, default: '["sysadmin"]' }]
}, 'epic');
