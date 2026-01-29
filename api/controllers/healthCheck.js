exports.healthCheck = (_, res) => {
  res.status(200).json({ status: 'ok' });
};
