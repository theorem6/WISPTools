// Re-export all models from distributed-epc-schema
const {
  RemoteEPC,
  EPCMetrics,
  SubscriberSession,
  AttachDetachEvent,
  EPCAlert
} = require('../../distributed-epc-schema');

module.exports = {
  RemoteEPC,
  EPCMetrics,
  SubscriberSession,
  AttachDetachEvent,
  EPCAlert
};

