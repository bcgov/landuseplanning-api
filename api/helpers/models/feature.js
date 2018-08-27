 module.exports = require ('../models')('Feature', {
    type             : { type: String, trim: true },
    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    tags             : [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
    geometry: {
        type        : { type: String, default: '' },
        coordinates : [[]]
    },
    geometryName     : { type:String, default: '' },
    properties  : { 
        INTRID_SID                  : { type: Number, default: 0 },
        TENURE_STAGE                : { type: String, default: '' },
        TENURE_STATUS               : { type: String, default: '' },
        TENURE_TYPE                 : { type: String, default: '' },
        TENURE_SUBTYPE              : { type: String, default: '' },
        TENURE_PURPOSE              : { type: String, default: '' },
        TENURE_SUBPURPOSE           : { type: String, default: '' },
        CROWN_LANDS_FILE            : { type: String, default: '' },
        TENURE_DOCUMENT             : { type: String, default: '' },
        TENURE_EXPIRY               : { type: String, default: '' },
        TENURE_LOCATION             : { type: String, default: '' },
        TENURE_LEGAL_DESCRIPTION    : { type: String, default: '' },
        TENURE_AREA_DERIVATION      : { type: String, default: '' },
        TENURE_AREA_IN_HECTARES     : { type: Number, default: 0 },
        RESPONSIBLE_BUSINESS_UNIT   : { type: String, default: '' },
        DISPOSITION_TRANSACTION_SID : { type: Number, default: '' },
        CODE_CHR_STAGE              : { type: String, default: '' },
        FEATURE_CODE                : { type: String, default: '' },
        FEATURE_AREA_SQM            : { type: Number, default: 0 },
        FEATURE_LENGTH_M            : { type: Number, default: 0 },
        OBJECTID                    : { type: Number, default: 0 },
        SE_ANNO_CAD_DATA            : { type: String, default: '' }
    },
    isDeleted     : { type: Boolean, default: false },
    // Which PRC application does this shape belong to?
    applicationID : { type:'ObjectId', ref:'Application', default:null}
});
