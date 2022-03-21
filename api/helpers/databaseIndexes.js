const mongoose = require('mongoose');
const winston = require('winston');
const defaultLog = winston.loggers.get('defaultLog');

/**
 * Runs once in app.js. Builds text schema for:
 * - Project: name
 * - RecentActivity: headline
 * - Document: documentFileName and displayName
 * 
 * @returns {void}
 */
module.exports.generateTextIndex = async () => {
    const Project = mongoose.model('Project');
    let schema = new mongoose.Schema();
    try {
        await Project.collection.dropIndex('text_index');
    } catch {
        /**
         * We don't log an error here because it's alright if dropIndex()
         * fails. We want to attempt to remove the old index and if it's not
         * found then that's acceptable. Without this try/catch, the app can
         * crash if dropIndex() doesn't find "text_index"
         */
        defaultLog.info('Attempted to remove index: "text_index" not found.')
    }

    // Text fields are added on a need-to-index basis. Add additional key-value pairs in first parameter obj
    schema.index({
        name: "text",
        headline: "text",
        documentFileName: "text", 
        displayName: "text"
    }, { name: "text_index"});

    return mongoose.model('textSchema', schema, 'lup');
}