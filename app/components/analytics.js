define([
  'underscore',
  'jquery',
  'discovery.vars'
], function (_, $, config) {
  /*
   * Set of targets
   * each has a set of hooks which coorespond to the event label passed
   * types represents the possible event targets which can be used
   * url is a template which will be passed the incoming data
   */
  var TARGETS = {
    resolver: {
      hooks: [
        'toc-link-followed',
        'abstract-link-followed',
        'citations-link-followed',
        'associated-link-followed'
      ],
      types: [
        'abstract', 'citations', 'references',
        'metrics', 'coreads', 'graphics', 'associated',
        [ 'tableofcontents', { redirectTo: 'toc' }]
      ],
      url: _.template('link_gateway/<%= bibcode %>/<%= target %>')
    }
  };

  /**
   * fire off the xhr request to the url
   *
   * @param {string} url
   * @param {object} data
   */
  var sendEvent = function (url) {
    $.ajax({ url: url, type: 'GET' });
  };

  /**
   * Go through the targets and fire the event if the label passed
   * matches one of the hooks specified.  Also the data.target must match one
   * of the types listed on the target config
   *
   * @param {string} label - the event label
   * @param {object} data - the event data
   */
  var adsLogger = function (label, data) {
    // if label or data is not present, do nothing
    if (_.isString(label) && _.isPlainObject(data) && _.has(data, 'target')) {
      _.forEach(TARGETS, function (val) {

        var target = null;
        _.forEach(val.types, function (type) {
          if (_.isArray(type)) {
            if (type[0] === data.target && _.has(type[1], 'redirectTo')) {
              target = type[1].redirectTo;
            }
          } else if (type === data.target) {
            target = type;
          }
        });

        // send event if we find a hook and the target is in the list of types
        if (_.contains(val.hooks, label) && target) {
          var params = _.assign({}, data, { target: target });
          sendEvent(data.url ? data.url : val.url(params));
        }
      });
    }
  };

  // Initial google analytics setup
  var qa = window[window.GoogleAnalyticsObject];
  qa.l = Date.now();
  qa('create', config.googleTrackingCode || '', config.googleTrackingOptions);

  // event handler
  var ga = window[window.GoogleAnalyticsObject];
  window[window.GoogleAnalyticsObject] = function () {
    try {
      ga.q = ga.q || [];
      ga.q.push([arguments]);
      ga.apply(ga, arguments);
    } catch (e) {
      console.info('google analytics event not tracked');
    }
  };

  var Analytics = function () {
    adsLogger.apply(null, _.rest(arguments, 3));
    try {
      window[window.GoogleAnalyticsObject].apply(this, arguments);
    } catch (e) {
      console.info('google analytics tracking not started');
    }
  };

  return Analytics;
});
