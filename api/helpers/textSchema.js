var mongoose = require('mongoose');

/**
 * Runs once in app.js. Builds text schema for:
 * Project schema: name field
 * RecentActivity schema: headline field
 */
module.exports.genTextSchema = function() {
    let schema = new mongoose.Schema();

    // Text fields are added on a need-to-index basis. Add additional key-value pairs in first parameter obj
    schema.index({name: "text", headline: "text"}, { name: "text_index"});

    return mongoose.model('textSchema', schema, 'lup');
}
