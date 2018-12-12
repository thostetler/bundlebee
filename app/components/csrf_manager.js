/*
 widgets can attach callbacks to a deferred that waits until
 * a new csrf token has been requested
 *
 * */
define([
  'backbone',
  'components/generic_module',
  'mixins/hardened',
  'components/api_request',
  'components/api_targets',
  'mixins/dependon'
],
function (
  Backbone,
  GenericModule,
  Hardened,
  ApiRequest,
  ApiTargets,
  Dependon
) {
  var CSRFManager = GenericModule.extend({

    activate: function (beehive) {
      this.setBeeHive(beehive);
      var pubsub = this.getPubSub();

      _.bindAll(this, ['resolvePromiseWithNewKey']);
      pubsub.subscribe(pubsub.DELIVERING_RESPONSE, this.resolvePromiseWithNewKey);
    },

    getCSRF: function () {
      this.deferred = $.Deferred();

      var request = new ApiRequest({
        target: ApiTargets.CSRF
      });

      var pubsub = this.getPubSub();
      pubsub.publish(pubsub.EXECUTE_REQUEST, request);
      return this.deferred.promise();
    },

    resolvePromiseWithNewKey: function (response) {
      // get csrf here
      var csrf = response.toJSON().csrf;
      this.deferred.resolve(csrf);
    },

    hardenedInterface: {
      getCSRF: 'getCSRF'
    }

  });

  _.extend(CSRFManager.prototype, Hardened, Dependon.BeeHive);

  return CSRFManager;
});
