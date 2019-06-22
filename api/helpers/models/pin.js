module.exports = require ('../models')('Pin', {
    name               : { type: String, default: ''},
    number             : { type: Number, default: ''},
    address1           : { type: String, default: '' },
    address2           : { type: String, default: '' },
    city               : { type: String, default: '' },
    province           : { type: String, default: '' },
    country            : { type: String, default: '' },
    postalCode         : { type: String, default: '' },
    phone              : { type: String, default: '' },
    fax                : { type: String, default: '' },
    www                : { type: String, default: '' },

    /*
      array of mixed:
      [{
        action: 'added' | 'removed',
        project: ObjectId,
        date: new Date(now).toISOString()
      }]
    */
    history            : [{ type: Mixed, default: {} }]
}, 'epic');
