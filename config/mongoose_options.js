const mongooseOptions = {
    maxPoolSize: 10,
    connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};
exports.mongooseOptions = mongooseOptions;