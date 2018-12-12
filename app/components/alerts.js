/**
 * Catalogue of Alerts (these are the messages that get displayed
 * to the user)
 */

define([
  'backbone',
  'mixins/hardened'
], function (
  Backbone,
  Hardened
) {
  var Alerts = {
    TYPE: {
      ERROR: 'error',
      INFO: 'info',
      WARNING: 'warning',
      SUCCESS: 'success',
      DANGER: 'danger'
    },

    ACTION: {
      CALL_PUBSUB: 2,
      TRIGGER_FEEDBACK: 1
    }
  };

  return Alerts;
});
