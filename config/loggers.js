require('dotenv').config();
const util = require('util');
const winston = require('winston');
const { format, transports } = winston;
const { combine, label, colorize, printf, timestamp } = format;

/**
 * Format the log output to include:
 * - log level
 * - log message
 * - label
 * - timestamp
 * - additional log messages passed as arguments to the logger("rest")
 */
const logFormat = printf(({ level, message, label = '', timestamp, ...rest }) => {
	const splat = rest[Symbol.for('splat')];
	const strArgs = splat ? splat.map((s) => util.formatWithOptions({ colors: true, depth: 10 }, s)).join(' ') : '';
	return `${label}[${timestamp}] ${level}:  ${util.formatWithOptions({ colors: true, depth: 10}, message)} ${strArgs}`;
});

/**
 * Modifies winston global config to add two loggers.
 * 
 * @returns {void}
 */
module.exports.configureAppLogging = () => {
    /**
     * Adds a default logger.
     */
    winston.loggers.add('defaultLog', {
        silent: 'true' === process.env.SILENCE_DEFAULT_LOG || false,
        transports: [
            new transports.Console({
            level: 'info',
            format: combine(
                colorize(),
                timestamp(new Date().toLocaleString("en-US", {timeZone: "America/Vancouver"})),
                logFormat
            )
            })
        ],
    });

    /**
     * Adds a logger for use in development.
     * 
     * Developers can silence the main logger and use this logger to focus
     * on specific logs without needing to sort through the output of the
     * default logger.
     */
    winston.loggers.add('devLog', {
    format: combine(
        label({ label: 'DEV LOGGER ' }),
    ),
    transports: [
        new winston.transports.Console({
            level: 'info',
            format: combine(
            label({ label: 'DEV LOGGER ' }),
            colorize(),
            timestamp(new Date().toLocaleString("en-US", {timeZone: "America/Vancouver"})),
            logFormat
            )
        })
    ]
    });
}