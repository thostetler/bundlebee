define(['marionette',
  'backbone',
  'underscore',
  'components/api_request',
  'components/api_query',
  'widgets/base/base_widget',
  'widgets/query_info/query_info_template.html',
  'mixins/formatter',
  'components/api_feedback'
],

function (Marionette,
  Backbone,
  _,
  ApiRequest,
  ApiQuery,
  BaseWidget,
  queryInfoTemplate,
  FormatMixin,
  ApiFeedback
) {
  var QueryModel = Backbone.Model.extend({

    defaults: {
      selected: 0,
      // for libraries
      libraryDrawerOpen: false,
      // for rendering library select
      libraries: [],
      loggedIn: false,
      feedback: undefined,
      newLibraryName: undefined,
      selectedLibrary: undefined
    }
  });

  var QueryDisplayView = Marionette.ItemView.extend({

   	  className: 'query-info-widget s-query-info-widget',
    template: queryInfoTemplate,

    serializeData: function () {
      var data = this.model.toJSON();
      data.selected = this.formatNum(data.selected);
      return data;
    },

    modelEvents: {
      'change:selected': 'render',
      'change:loggedIn': 'render',
      'change:libraries': 'render',
      'change:feedback': 'render'
    },

    triggers: {
      'click .clear-selected': 'clear-selected'
    },

    events: {

      'change #all-vs-selected': 'recordAllVsSelected',
      'change #library-select': 'recordLibrarySelection',
      'keyup .new-library-name': 'recordNewLibraryName',
      'click .library-add-title': 'toggleLibraryDrawer',
      'click .submit-add-to-library': 'libraryAdd',
      'click .submit-create-library': 'libraryCreate'
    },

    recordLibrarySelection: function (e) {
      this.model.set('selectedLibrary', $(e.currentTarget).val());
    },

    recordNewLibraryName: function (e) {
      this.model.set('newLibraryName', $(e.currentTarget).val());
    },

    recordAllVsSelected: function (e) {
      this.model.set('selectedVsAll', $(e.currentTarget).val());
    },

    libraryAdd: function () {
      // show loading view
      this.$('.submit-add-to-library').html('<i class="fa fa-spinner fa-pulse"></i>');

      var data = {};

      // we have the selected library in the model but only if there was a select event, so query DOM
      data.libraryID = this.$('#library-select').val();

      if (this.model.get('selected')) {
        data.recordsToAdd = this.$('#all-vs-selected').val();
      } else {
        data.recordsToAdd = 'all';
      }
      this.trigger('library-add', data);
    },

    libraryCreate: function () {
      // show loading view
      this.$('.submit-create-library').html('<i class="fa fa-spinner fa-pulse"></i>');

      var data = {};

      if (this.model.get('selected')) {
        data.recordsToAdd = this.$('#all-vs-selected').val();
      } else {
        data.recordsToAdd = 'all';
      }

      data.name = this.model.get('newLibraryName') || '';
      data.name = data.name.trim();
      this.trigger('library-create', data);
    },

    toggleLibraryDrawer: function () {
      this.model.set('libraryDrawerOpen', !this.model.get('libraryDrawerOpen'), { silent: true });
    },

    onRender: function () {
      this.$('.icon-help').popover({ trigger: 'hover', placement: 'right', html: true });
    }

  });

  _.extend(QueryDisplayView.prototype, FormatMixin);

  var Widget = BaseWidget.extend({

    modelConstructor: QueryModel,
    viewConstructor: QueryDisplayView,

    initialize: function (options) {
      options = options || {};

      this.model = new QueryModel();
      this.view = new QueryDisplayView({ model: this.model, template: options.template });
      BaseWidget.prototype.initialize.call(this, options);
    },

    viewEvents: {
      'clear-selected': 'clearSelected',
      'library-add': 'libraryAddSubmit',
      'library-create': 'libraryCreateSubmit',
    },

    activate: function (beehive) {
      this.setBeeHive(beehive);
      _.bindAll(this);

      var that = this;

      var pubsub = this.getPubSub();
      pubsub.subscribe(pubsub.STORAGE_PAPER_UPDATE, this.onStoragePaperChange);
      pubsub.subscribe(pubsub.LIBRARY_CHANGE, this.processLibraryInfo);
      pubsub.subscribe(pubsub.USER_ANNOUNCEMENT, this.handleUserAnnouncement);

      // check if user is signed in (because widget was just instantiated, but app might have been running for a while
      if (this.getBeeHive().getObject('User').isLoggedIn()) {
        // know whether to show library panel
        this.model.set('loggedIn', true);
        // fetch list of libraries
        var libraryData = this.getBeeHive().getObject('LibraryController')
          .getLibraryMetadata()
          .done(function (data) {
            that.processLibraryInfo(data);
          });
      }
    },

    handleUserAnnouncement: function (event, arg) {
      var user = this.getBeeHive().getObject('User');
      if (event == user.USER_SIGNED_IN) {
        this.model.set('loggedIn', true);
      } else if (event == user.USER_SIGNED_OUT) {
        this.model.set('loggedIn', false);
      }
    },

    onStoragePaperChange: function (numSelected) {
      this.model.set('selected', numSelected);
    },

    processLibraryInfo: function (data) {
      data.sort(function (a, b) {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      this.model.set('libraries', data);
    },

    clearSelected: function () {
      this.getBeeHive().getObject('AppStorage').clearSelectedPapers();
    },

    libraryAddSubmit: function (data) {
      var options = {},
        that = this;

      options.library = data.libraryID;
      // are we adding the current query or just the selected bibcodes?
      // if it's an abstract page widget, will have this._bibcode val
      if (this.abstractPage) {
        options.bibcodes = [this._bibcode];
      } else {
        options.bibcodes = data.recordsToAdd;
      }

      var name = _.findWhere(this.model.get('libraries'), { id: data.libraryID }).name;

      // this returns a promise
      this.getBeeHive().getObject('LibraryController').addBibcodesToLib(options)
        .done(function (response, status) {
          var numAlreadyInLib = response.numBibcodesRequested - parseInt(response.number_added);
          that.model.set('feedback', {
            success: true,
            name: name,
            id: data.libraryID,
            numRecords: response.number_added,
            numAlreadyInLib: numAlreadyInLib
          });
        })
        .fail(function (response) {
          that.model.set('feedback', {
            success: false,
            name: name,
            id: data.libraryID,
            error: JSON.parse(arguments[0].responseText).error
          });
        });

      this.clearFeedbackWithDelay();
    },

    libraryCreateSubmit: function (data) {
      var options = {},
        that = this;
      // are we adding the current query or just the selected bibcodes?
      // if it's an abstract page widget, will have this._bibcode val
      if (this.abstractPage) {
        options.bibcodes = [this._bibcode];
      } else {
        options.bibcodes = data.recordsToAdd;
      }
      options.name = data.name;
      // XXX:rca - to decide
      this.getBeeHive().getObject('LibraryController').createLibAndAddBibcodes(options)
        .done(function (response, status) {
          // reset library add name (in input field)
          that.model.set('newLibraryName', undefined);

          that.model.set('feedback', {
            create: true,
            success: true,
            name: data.name,
            id: response.id,
            numRecords: response.bibcode.length
          });
        })
        .fail(function (response) {
          that.model.set('feedback', {
            success: false,
            name: data.name,
            create: true,
            error: JSON.parse(arguments[0].responseText).error
          });
        });

      this.clearFeedbackWithDelay();
    },

    clearFeedbackWithDelay: function () {
      var that = this,
        // ten seconds
        timeout = 30000;

      setTimeout(function () {
        that.model.unset('feedback');
      }, timeout);
    },

    processResponse: function (apiResponse) {
      var q = apiResponse.getApiQuery();
      var filters = [];
      _.each(q.keys(), function (k) {
        if (k.substring(0, 2) == 'fq') {
          _.each(q.get(k), function (v) {
            if (v.indexOf('{!') == -1) {
              filters.push(v);
            }
          });
        }
      });
      this.view.model.set('fq', filters);
    }

  });

  return Widget;
});
