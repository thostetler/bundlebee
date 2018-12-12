/**
 * Created by rchyla on 3/16/14.
 */

define([
  'underscore',
  'mixins/hardened',
  'services/default_pubsub',
  'components/pubsub_events'
],
  function (_, Hardened, PubSubImplementation, PubSubEvents) {
    var PubSub = PubSubImplementation.extend({

    /*
     * Wraps itself into a Facade that can be shared with other modules
     * (it is read-only); absolutely non-modifiable and provides the
     * following callbacks:
     *  - publish
     *  - subscribe
     *  - unsubscribe
     *  - getPubSubKey
     */
      hardenedInterface: {
        subscribe: 'register callback',
        unsubscribe: 'deregister callback',
        publish: 'send data to the queue',
        getPubSubKey: 'get secret key'
      }
    });

    _.extend(PubSub.prototype, Hardened, {
    /**
     * The PubSub hardened instance will expose different
     * api - it doesn't allow modules to pass the PubSubKey
     *
     * @param iface
     * @returns {*}
     */
      getHardenedInstance: function (iface) {
        iface = _.clone(iface || this.hardenedInterface);

        // build a unique key for this instance
        var ctx = {
          key: this.getPubSubKey()
        };
        var self = this;
        // purpose of these functions is to expose simplified
        // api (without need to pass pubsubkey explicitly)
        iface.publish = function () {
          self.publish.apply(self, [ctx.key].concat(_.toArray(arguments)));
        };
        iface.subscribe = function () {
          self.subscribe.apply(self, [ctx.key].concat(_.toArray(arguments)));
        };
        iface.unsubscribe = function () {
          self.unsubscribe.apply(self, [ctx.key].concat(_.toArray(arguments)));
        };
        iface.subscribeOnce = function () {
          self.subscribeOnce.apply(self, [ctx.key].concat(_.toArray(arguments)));
        };
        iface.getCurrentPubSubKey = function () {
          return ctx.key;
        };
        var hardened = this._getHardenedInstance(iface, this);
        _.extend(hardened, PubSubEvents);

        return hardened;
      }
    });
    _.extend(PubSub.prototype, PubSubEvents);

    return PubSub;
  });
