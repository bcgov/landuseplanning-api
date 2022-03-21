require('dotenv').config();
const winston = require('winston');
const { format, transports } = winston;
const { combine, label, colorize, printf, timestamp } = format;

const logFormat = printf(({ level, message, label = '', timestamp }) => {
  return `${label}[${timestamp}] ${level}: ${message}`;
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