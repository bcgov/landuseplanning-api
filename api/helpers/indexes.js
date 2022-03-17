const mongoose = require('mongoose');
const winston = require('winston');

const defaultLog = winston.loggers.get('default');

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