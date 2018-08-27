"use strict";

var app           = require("express")();
var fs            = require('fs');
var uploadDir     = process.env.UPLOAD_DIRECTORY || "./uploads/";
var hostname      = process.env.API_HOSTNAME || "localhost:3000";
var swaggerTools  = require("swagger-tools");
var YAML          = require("yamljs");
var mongoose      = require("mongoose");
var passport      = require("passport");
var auth          = require("./api/helpers/auth");
var models        = require("./api/helpers/models");
var swaggerConfig = YAML.load("./api/swagger/swagger.yaml");
var winston       = require('winston');
var bodyParser    = require('body-parser');

var dbConnection  = 'mongodb://'
                    + (process.env.MONGODB_SERVICE_HOST || process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost')
                    + '/'
                    + (process.env.MONGODB_DATABASE || 'nrts-dev');
var db_username = process.env.MONGODB_USERNAME || '';
var db_password = process.env.MONGODB_PASSWORD || '';

// Logging middleware
winston.loggers.add('default', {
    console: {
        colorize: 'true',
        handleExceptions: true,
        json: false,
        level: 'silly',
        label: 'default',
    }
});
var defaultLog = winston.loggers.get('default');

// Increase postbody sizing
app.use(bodyParser.json({limit: '10mb', extended: true}))
app.use(bodyParser.urlencoded({limit: '10mb', extended: true}));

// Enable CORS
app.use(function (req, res, next) {
  defaultLog.info(req.method, req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization,responseType');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

// Dynamically set the hostname based on what environment we're in.
swaggerConfig.host = hostname;

// Swagger UI needs to be told that we only serve https in Openshift
if (hostname !== 'localhost:3000') {
  swaggerConfig.schemes = ['https'];
}

swaggerTools.initializeMiddleware(swaggerConfig, function(middleware) {
  app.use(middleware.swaggerMetadata());

  // TODO: Fix this
  // app.use(middleware.swaggerValidator({ validateResponse: false}));

  app.use(
    middleware.swaggerSecurity({
      Bearer: auth.verifyToken
    })
  );
  
  var routerConfig = {
    controllers: "./api/controllers",
    useStubs: false
  };

  app.use(middleware.swaggerRouter(routerConfig));

  app.use(middleware.swaggerUi({apiDocs: '/api/docs', swaggerUi: '/api/docs'}));

  // Make sure uploads directory exists
  try {
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }
  } catch (e) {
    // Fall through - uploads will continue to fail until this is resolved locally.
    defaultLog.info("Couldn't create upload folder:", e);
  }
  // Load up DB
  var options = {
    useMongoClient: true,
    poolSize: 10,
    user: db_username,
    pass: db_password
  };
  defaultLog.info("Connecting to:", dbConnection);
  mongoose.Promise  = global.Promise;
  var db = mongoose.connect(dbConnection, options).then(
    () => {
      defaultLog.info("Database connected");

      // Load database models
      defaultLog.info("loading db models.");
      require('./api/helpers/models/user');
      require('./api/helpers/models/application');
      require('./api/helpers/models/feature');
      require('./api/helpers/models/document');
      require('./api/helpers/models/comment');
      require('./api/helpers/models/commentperiod');
      require('./api/helpers/models/decision');
      require('./api/helpers/models/review');
      require('./api/helpers/models/organization');
      defaultLog.info("db model loading done.");

      app.listen(3000, '0.0.0.0', function() {
        defaultLog.info("Started server on port 3000");
      });
    },
    err => {
      defaultLog.info("err:", err);
      return;
    });
});
