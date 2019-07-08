module.exports = require ('../models')('Group', {
    name                    : { type:String, default:'' },
    project                 : { type:'ObjectId', ref:'Project', default:null },
    members                 : [{ type:'ObjectId', ref:'User', default:null }],

    read             : [{ type: String, trim: true, default: '["sysadmin"]' }],
    write            : [{ type: String, trim: true, default: '["sysadmin"]' }],
    delete           : [{ type: String, trim: true, default: '["sysadmin"]' }]
}, 'epic');
