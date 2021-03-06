
define([
  'widgets/export/widget'
],

function (
  ExportWidget
) {
  var Widget = ExportWidget.extend({

    initialize: function (options) {
      // other widgets can send us data through page manager
      this.on('page-manager-message', function (event, data) {
        if (event === 'broadcast-payload') {
          this.ingestBroadcastedPayload(data);
        }
      });
      ExportWidget.prototype.initialize.call(this, options);
    },

    activate: function (beehive) {
      this.setBeeHive(beehive);
      _.bindAll(this, 'setCurrentQuery', 'processResponse');
      var pubsub = this.getPubSub();
      pubsub.subscribe(pubsub.DELIVERING_RESPONSE, this.processResponse);
      ExportWidget.prototype.activate.call(this, beehive);
    },

    ingestBroadcastedPayload: function (data) {
      if (data.bibcode) {
        this.bibcode = data.bibcode;
      }
    },

    setSubView: function (format) {
      this.renderWidgetForListOfBibcodes([this.bibcode], { format: format });
    }

  });

  return Widget;
});
