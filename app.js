"use strict";

var app           = require("express")();
var swaggerTools  = require("swagger-tools");
var YAML          = require("yamljs");
var mongoose      = require("mongoose");
var passport      = require("passport");
var auth          = require("./api/helpers/auth");
var models        = require("./api/helpers/models");
var swaggerConfig = YAML.load("./api/swagger/swagger.yaml");
var winston        = require('winston');

var dbConnection  = 'mongodb://'
                    + (process.env.MONGODB_SERVICE_HOST || process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost')
                    + '/'
                    + (process.env.MONGODB_DATABASE || 'nrts-dev');


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

// Enable CORS
app.use(function (req, res, next) {
  defaultLog.info(req.method, req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

swaggerTools.initializeMiddleware(swaggerConfig, function(middleware) {
  app.use(middleware.swaggerMetadata());
  
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

  app.use(middleware.swaggerUi());

  // Load up DB
  var options = {
    useMongoClient: true,
    poolSize: 10
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
      defaultLog.info("db model loading done.");

      app.listen(3000, function() {
        defaultLog.info("Started server on port 3000");
      });
    },
    err => {
      defaultLog.info("err:", err);
      return;
    });
});
