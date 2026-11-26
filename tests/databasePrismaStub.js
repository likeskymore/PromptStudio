module.exports = {
  prisma: {
    $transaction: async (callback) => {
      const connection = {
        experiment: { findFirst: async () => undefined },
      };
      return callback(connection);
    },
  },
  getClient: (connection) => connection || {},
};
