/**
 * Widget to display list of result hits - it allows to paginate through them
 * and display details
 *
 */

define([
  'widgets/list_of_things/widget',
  'widgets/abstract/widget',
  'mixins/add_stable_index_to_collection',
  'mixins/link_generator_mixin',
  'mixins/formatter',
  'widgets/results/templates/container-template.html',
  'mixins/papers_utils',
  'modules/orcid/extension',
  'mixins/dependon',
  'components/api_feedback'
],

function (
  ListOfThingsWidget,
  AbstractWidget,
  PaginationMixin,
  LinkGenerator,
  Formatter,
  ContainerTemplate,
  PapersUtilsMixin,
  OrcidExtension,
  Dependon,
  ApiFeedback
) {
  var ResultsWidget = ListOfThingsWidget.extend({
    initialize: function () {
      ListOfThingsWidget.prototype.initialize.apply(this, arguments);
      // now adjusting the List Model
      this.view.template = ContainerTemplate;

      this.view.model.defaults = function () {
        return {
          mainResults: true,
          title: undefined,
          // assuming there will always be abstracts
          showAbstract: 'closed',
          makeSpace: false,
          // often they won't exist
          showHighlights: 'closed',
          pagination: true
        };
      };
      this.model.set(this.model.defaults(), { silent: true });

      // also need to add an event listener for the "toggle all" action
      this.view.toggleAll = function (e) {
        var flag = e.target.checked ? 'add' : 'remove';
        this.trigger('toggle-all', flag);
      };

      _.extend(this.view.events, {
        'click input#select-all-docs': 'toggleAll'
      });

      this.view.resultsWidget = true;
      this.view.delegateEvents();
      // this must come after the event delegation!
      this.listenTo(this.collection, 'reset', this.checkDetails);
      // finally, listen
      // to this event on the view
      this.listenTo(this.view, 'toggle-all', this.triggerBulkAction);
      this.minAuthorsPerResult = 3;

      this.model.on('change:makeSpace', _.bind(this.onMakeSpace, this));
    },

    defaultQueryArguments: {
      'fl': 'title,abstract,bibcode,author,keyword,id,links_data,property,esources,data,citation_count,[citations],pub,aff,email,volume,pubdate,doi,doctype',
      'rows': 25,
      'start': 0
    },

    activate: function (beehive) {
      ListOfThingsWidget.prototype.activate.apply(this, [].slice.apply(arguments));
      var pubsub = beehive.getService('PubSub');
      _.bindAll(this, 'dispatchRequest', 'processResponse', 'onUserAnnouncement', 'onStoragePaperUpdate', 'onCustomEvent', 'onStartSearch');
      pubsub.subscribe(pubsub.INVITING_REQUEST, this.dispatchRequest);
      pubsub.subscribe(pubsub.DELIVERING_RESPONSE, this.processResponse);
      pubsub.subscribe(pubsub.USER_ANNOUNCEMENT, this.onUserAnnouncement);
      pubsub.subscribe(pubsub.STORAGE_PAPER_UPDATE, this.onStoragePaperUpdate);
      pubsub.subscribe(pubsub.CUSTOM_EVENT, this.onCustomEvent);
      pubsub.subscribe(pubsub.START_SEARCH, this.onStartSearch);
      this.queryTimer = +new Date();
    },

    _clearResults: function () {
      this.hiddenCollection.reset();
      this.view.collection.reset();
    },

    onStartSearch: function (apiQuery) {
      // quickly check if the query changed
      try {
        var beehive = this.getBeeHive();
        var storage = beehive.getObject('AppStorage');
        var history = beehive.getService('HistoryManager');
        var recentQuery = storage.getCurrentQuery().toJSON()
        var currentQuery = apiQuery.toJSON();
        var previousNav = history.getCurrentNav();
      } catch (e) {
        return;
      }

      if (!_.isEqual(recentQuery, currentQuery)) {
        this._clearResults();
      } else if (_.isArray(previousNav) && previousNav[0] === 'ShowAbstract') {

        // clear the focus interval
        clearInterval(this.focusInterval);

        // loop for a while, in case we have to wait for the elemen to show up
        var focusInterval = setInterval(function () {
          var $link = $('a[href$="' + previousNav[1].href + '"]');
          if ($link) {

            // found it, clear the interval and scroll
            clearInterval(focusInterval);
            $('#app-container').animate({ scrollTop: $link.offset().top }, 'fast');
          }
        }, 100);

        // clear it after a timeout no matter what
        setTimeout(function () { clearInterval(focusInterval); }, 10000);
        this.focusInterval = focusInterval;
      }
      this.queryTimer = +new Date();
    },

    onMakeSpace: function () {
      var pubsub = this.getPubSub();
      var code = this.model.get('makeSpace') ? 'MAKE_SPACE' : 'UNMAKE_SPACE';
      pubsub.publish(pubsub.FEEDBACK, new ApiFeedback({ code: ApiFeedback.CODES[code] }));
    },

    onUserAnnouncement: function (message, data) {
      if (message == 'user_info_change' && _.has(data, 'isOrcidModeOn')) {
        // make sure to reset orcid state of all cached records, not just currently
        // visible ones
        var collection = this.hiddenCollection.toJSON();
        var docs = _.map(collection, function (x) {
          delete x.orcid;
          return x;
        });

        if (data.isOrcidModeOn) { this.addOrcidInfo(docs); }

        this.hiddenCollection.reset(docs);
        this.view.collection.reset(this.hiddenCollection.getVisibleModels());
      }
      this.updateMinAuthorsFromUserData();
      this.updateSidebarsFromUserData();
    },

    onCustomEvent: function (event) {
      if (event === 'add-all-on-page') {
        var bibs = this.collection.pluck('bibcode');
        var pubsub = this.getPubSub();
        pubsub.publish(pubsub.BULK_PAPER_SELECTION, bibs);
      }
    },

    dispatchRequest: function (apiQuery) {
      this.reset();
      this.setCurrentQuery(apiQuery);
      ListOfThingsWidget.prototype.dispatchRequest.call(this, apiQuery);
    },

    customizeQuery: function (apiQuery) {
      var q = apiQuery.clone();
      q.unlock();

      if (this.defaultQueryArguments) {
        q = this.composeQuery(this.defaultQueryArguments, q);
      }

      return q;
    },

    checkDetails: function () {
      var hExists = false;
      for (var i = 0; i < this.collection.models.length; i++) {
        var m = this.collection.models[i];
        if (m.attributes.highlights) {
          hExists = true;
          break;
        }
      }
    },

    getUserData: function () {
      try {
        var beehive = _.isFunction(this.getBeeHive) && this.getBeeHive();
        var user = _.isFunction(beehive.getObject) && beehive.getObject('User');
        if (_.isPlainObject(user)) {
          return _.isFunction(user.getUserData) && user.getUserData('USER_DATA');
        }
        return {};
      } catch (e) {
        return {};
      }
    },

    updateMinAuthorsFromUserData: function () {
      var userData = this.getUserData();
      var min = _.has(userData, 'minAuthorsPerResult') ?
        userData.minAuthorsPerResult : this.minAuthorsPerResult;

      if (String(min).toUpperCase() === 'ALL') {
        this.minAuthorsPerResult = Number.MAX_SAFE_INTEGER;
      } else if (String(min).toUpperCase() === 'NONE') {
        this.minAuthorsPerResult = 0;
      } else {
        this.minAuthorsPerResult = Number(min);
      }
    },

    updateSidebarsFromUserData: _.debounce(function () {
      var userData = this.getUserData();

      // grab the negated current value
      var makeSpace = !this.model.get('makeSpace') ? 'SHOW' : 'HIDE';

      // get the state from user data or take the current value
      var sideBarsState = (_.has(userData, 'defaultHideSidebars') ?
        userData.defaultHideSidebars : makeSpace).toUpperCase();

      // compare them, we don't have to update if nothing is changing
      if (makeSpace !== sideBarsState) {
        this.model.set('makeSpace', sideBarsState === 'HIDE');
        this.model.trigger('change:makeSpace');
      }
    }, 300),

    processDocs: function (apiResponse, docs, paginationInfo) {
      var params = apiResponse.get('responseHeader.params');
      var start = params.start || 0;
      var docs = PaginationMixin.addPaginationToDocs(docs, start);
      var highlights = apiResponse.has('highlighting') ? apiResponse.get('highlighting') : {};
      var self = this;
      var userData = this.getBeeHive().getObject('User').getUserData('USER_DATA');
      var link_server = userData.link_server;
      this.updateMinAuthorsFromUserData();
      this.updateSidebarsFromUserData();

      var appStorage = null;
      if (this.hasBeeHive() && this.getBeeHive().hasObject('AppStorage')) {
        appStorage = this.getBeeHive().getObject('AppStorage');
      }

      // stash docs so other widgets can access them
      this.getBeeHive().getObject('DocStashController').stashDocs(docs);

      // any preprocessing before adding the resultsIndex is done here
      docs = _.map(docs, function (d) {
        // used by link generator mixin
        d.link_server = link_server;
        d.identifier = d.bibcode;

        // make sure undefined doesn't become "undefined"
        d.encodedIdentifier = _.isUndefined(d.identifier)
          ? d.identifier : encodeURIComponent(d.identifier);
        var h = {};

        if (_.keys(highlights).length) {
          h = (function () {
            var hl = highlights[d.id];
            var finalList = [];

            // adding abstract,title, etc highlights to one big list
            _.each(_.pairs(hl), function (pair) {
              finalList = finalList.concat(pair[1]);
            });

            if (finalList.length === 1 && finalList[0].trim() === '') {
              return {};
            }

            return {
              highlights: finalList
            };
          }());
        }

        var maxAuthorNames = self.minAuthorsPerResult;
        var shownAuthors;

        if (d.author && d.author.length > maxAuthorNames) {
          d.extraAuthors = d.author.length - maxAuthorNames;
          shownAuthors = d.author.slice(0, maxAuthorNames);
        } else if (d.author) {
          shownAuthors = d.author;
        }

        if (d.author) {
          var format = function (d, i, arr) {
            var l = arr.length - 1;
            if (i === l || l === 0) {
              return d; // last one, or only one
            }
            return d + ';';
          };
          d.authorFormatted = _.map(shownAuthors, format);
          d.allAuthorFormatted = _.map(d.author, format);
        }

        if (h.highlights && h.highlights.length > 0) {
          d.highlights = h.highlights;
        }

        d.formattedDate = d.pubdate ? self.formatDate(d.pubdate, { format: 'yy/mm', missing: { day: 'yy/mm', month: 'yy' } }) : undefined;
        d.shortAbstract = d.abstract ? self.shortenAbstract(d.abstract) : undefined;

        if (appStorage && appStorage.isPaperSelected(d.identifier)) {
          d.chosen = true;
        }

        return d;
      });

      try {
        docs = this.parseLinksData(docs);
      } catch (e) {
        console.warn(e.message);
      }

      // if the latest request equals the total perPage, then we're done, send off event
      if (this.pagination && this.pagination.perPage === (+params.start + +params.rows)) {
        var pubsub = this.getPubSub();
        pubsub.publish(pubsub.CUSTOM_EVENT, 'timing:results-loaded', +new Date() - this.queryTimer);
      }

      return docs;
    },

    onStoragePaperUpdate: function () {
      var appStorage;
      if (this.hasBeeHive() && this.getBeeHive().hasObject('AppStorage')) {
        appStorage = this.getBeeHive().getObject('AppStorage');
      } else {
        console.warn('AppStorage object disapperared!');
        return;
      }
      this.collection.each(function (m) {
        if (appStorage.isPaperSelected(m.get('identifier'))) {
          m.set('chosen', true);
        } else {
          m.set('chosen', false);
        }
      });
      this.hiddenCollection.each(function (m) {
        if (appStorage.isPaperSelected(m.get('identifier'))) {
          m.set('chosen', true);
        } else {
          m.set('chosen', false);
        }
      });
      if (this.collection.where({ chosen: true }).length == 0) {

        // make sure the "selectAll" button is unchecked
        var $chk = this.view.$('input#select-all-docs');
        if ($chk.length > 0) {
          $chk[0].checked = false;
        }
      }
    },

    triggerBulkAction: function (flag) {
      var bibs = this.collection.pluck('bibcode');
      this.getPubSub().publish(this.getPubSub().BULK_PAPER_SELECTION, bibs, flag);
    }

  });

  _.extend(ResultsWidget.prototype, LinkGenerator);
  _.extend(ResultsWidget.prototype, Formatter);
  _.extend(ResultsWidget.prototype, PapersUtilsMixin, Dependon.BeeHive);
  return OrcidExtension(ResultsWidget);
});
