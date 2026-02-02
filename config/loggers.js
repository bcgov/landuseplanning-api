require('dotenv').config();
const util = require('util');
const winston = require('winston');

const { format, transports } = winston;
const { combine, printf, splat, errors, colorize, label: labelFmt } = format;

// Boolean flag parser
const boolFromEnv = (v, def = false) =>
  v == null ? def : /^(true|1|yes)$/i.test(String(v).trim());

// Per-record Vancouver timestamp formatter
const tzTimestamp = format((info) => {
  info.timestamp = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return info;
});

/**
 * Unified printf that:
 *  - shows level, label, timestamp
 *  - pretty-prints the message
 *  - appends additional args (splat) with util.formatWithOptions
 *  - preserves colors if colorize() is in the chain
 */
const logFormat = printf(
  ({ level, message, label = '', timestamp, ...rest }) => {
    // Get Winston "splat" arguments (requires format.splat() earlier in the chain)
    const splatted = rest[Symbol.for('splat')];

    const formattedMsg = util.formatWithOptions(
      { colors: true, depth: 10 },
      message
    );

    const extra =
      splatted && splatted.length
        ? ' ' +
          splatted
            .map((s) => util.formatWithOptions({ colors: true, depth: 10 }, s))
            .join(' ')
        : '';

    const prefix = label ? `${label}` : '';
    return `${prefix}[${timestamp}] [${level}] ${formattedMsg}${extra}`;
  }
);

// Configure logger
module.exports.configureAppLogging = () => {
  // Default logger with no colour
  const silenceDefault = boolFromEnv(process.env.SILENCE_DEFAULT_LOG, false);
  const defaultLevel = process.env.LOG_LEVEL || 'info';
  
  winston.loggers.add('defaultLog', {
    silent: silenceDefault,
    transports: [
      new transports.Console({
        level: defaultLevel,
        format: combine(
          errors({ stack: true }),
          splat(),
          tzTimestamp(),
          logFormat
        )
      })
    ]
  });

   // Developer logger
  const devLevel = process.env.DEV_LOG_LEVEL || 'info';
  const devSilenced = boolFromEnv(process.env.SILENCE_DEV_LOG, false);
 
  winston.loggers.add('devLog', {
    silent: devSilenced,
    transports: [
      new transports.Console({
        level: devLevel,
        format: combine(
          errors({ stack: true }),
          splat(),
          labelFmt({ label: 'DEV' }),
          colorize(),
          tzTimestamp(),
          logFormat
        )
      })
    ]
  });
};
