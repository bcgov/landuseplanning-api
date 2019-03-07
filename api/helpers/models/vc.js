module.exports = require ('../models')('Vc', {
    code        : { type: String, trim: true, default: ''},
    description : { type: String, trim: true, default: ''},
    name        : { type: String, trim: true, default: ''},
    parent      : { type: 'ObjectId', ref: 'Vc', default: null, index: true },
    pillar      : { type: String, trim: true, default: ''},
    project     : { type: 'ObjectId', ref: 'Project', default: null, index: true },
    stage       : { type: String, trim: true, default: ''},
    title       : { type: String, trim: true, default: ''},
    type        : { type: String, trim: true, default: ''},
    
    // Permissions
    read        : [{ type: String, trim: true, default: '["public"]' }],
    write       : [{ type: String, trim: true, default: '["project-system-admin"]' }],
    delete      : [{ type: String, trim: true, default: '["project-system-admin"]' }]
});

    // "updatedBy" : ObjectId("58850fa0aaecd9001b808895"),
    // "addedBy" : ObjectId("58850fa0aaecd9001b808895"),
    // "dateUpdated" : ISODate("2017-02-07T21:58:57.651Z"),
    // "dateAdded" : ISODate("2017-02-07T16:41:54.253Z"),
    // "status" : "",
    // "indicators" : "Text describing indicators",
    // "subComponents" : [ 
    //     ObjectId("5899f8d09372a0001dc40409"), 
    //     ObjectId("589a084e5658e1001d229bb3")
    // ],
    // "parent" : "",
    // "topiccode" : "",
    // "artifact" : ObjectId("5899f8d29372a0001dc404be")