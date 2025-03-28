exports.healthCheck = function (args, res) {
  res.status(200).json({ status: 'ok' });
}