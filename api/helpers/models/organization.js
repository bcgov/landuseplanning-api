 module.exports = require ('../models')('Organization', {
    // _addedBy         : { type:'ObjectId', ref:'User', default:null },
    tags             : [[{ type: String, trim: true, default: '' }]],
    code             : { type: String, trim: true, default: ''},
    name             : { type: String, trim: true }
});
