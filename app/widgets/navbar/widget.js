define([
  'underscore',
  'widgets/base/base_widget',
  'widgets/navbar/template/navbar.html',
  'widgets/navbar/template/feedback.html',
  'components/api_query_updater',
  'components/api_query',
  'components/api_request',
  'components/api_targets'
], function (
  _,
  BaseWidget,
  NavBarTemplate,
  FeedbackTemplate,
  ApiQueryUpdater,
  ApiQuery,
  ApiRequest,
  ApiTargets
) {
  var NavView,
    NavModel,
    NavWidget;

  NavModel = Backbone.Model.extend({
    defaults: function () {
      return {
        orcidModeOn: false,
        orcidLoggedIn: false,
        currentUser: undefined,
        orcidFirstName: undefined,
        orcidLastName: undefined,
        // should it show hourly banner?
        hourly: false,
        timeout: 600000 // 10 minutes
      };
    }
  });


  NavView = Marionette.ItemView.extend({

    template: NavBarTemplate,

    modelEvents: {
      change: 'render'
    },

    events: {
      'click .orcid-dropdown ul': 'stopPropagation',
      'click button.orcid-sign-in': 'orcidSignIn',
      'change .orcid-mode': 'changeOrcidMode',

      // to avoid stopPropagation as in triggers hash
      'click .orcid-link': function () {
        this.trigger('navigate-to-orcid-link');
      },
      'click .orcid-logout': function (e) {
        e.preventDefault();
        this.trigger('logout-only-orcid');
      },
      'click .logout': function (e) {
        e.preventDefault();
        this.trigger('logout');
      },
      'click .login': function () {
        this.trigger('navigate-login');
      },
      'click .register': function () {
        this.trigger('navigate-register');
      },
      'click button.search-author-name': function (e) {
        this.trigger('search-author');
      }
    },

    stopPropagation: function (e) {
      if (e.target.tagName.toLowerCase() == 'button' || e.target.tagName.toLowerCase() == 'a' || e.target.tagName.toLowerCase() == 'code') {
        return true;
      }

      e.stopPropagation();
    },

    orcidSignIn: function () {
      this.model.set('orcidModeOn', true);
      // need to explicitly trigger to widget that this has changed
      // otherwise it will be ignored, since it can also be changed
      // from outside
      this.trigger('user-change-orcid-mode');
    },

    changeOrcidMode: function (ev) {
      var checked = _.isBoolean(ev) ? ev : ev && ev.currentTarget && ev.currentTarget.checked;
      this.model.set('orcidModeOn', checked);
      this.trigger('user-change-orcid-mode');
      this.render();
    },

    onRender: function () {
      var that = this;

      if (!this.formAttached) {
        // attach modal
        $('body').append(FeedbackTemplate());

        var $modal = $('#feedback-modal');

        function clearForm() {
          $modal.find('.modal-body').html($(FeedbackTemplate()).find('form'));
        }

        // make sure to clear the form when the modal closes
        $modal.on('hidden.bs.modal', clearForm);

        $modal.on('shown.bs.modal', function () {
          that.trigger('activate-recaptcha');
        });

        // attach submit handler
        $('.feedback-form').submit(function (e) {
          e.preventDefault();
          that.trigger('feedback-form-submit', $(e.target), $modal);
        });

        this.formAttached = true;
      }
    }

  });

  NavWidget = BaseWidget.extend({

    initialize: function (options) {
      options = options || {};
      this.model = new NavModel();
      this.view = new NavView({ model: this.model });
      BaseWidget.prototype.initialize.apply(this, arguments);
      this.qUpdater = new ApiQueryUpdater('NavBar');
    },

    activate: function (beehive) {
      this.setBeeHive(beehive);
      _.bindAll(this, ['handleUserAnnouncement', 'getOrcidUserInfo', 'storeLatestPage', 'onCustomEvent']);
      var pubsub = this.getPubSub();
      pubsub.subscribe(pubsub.USER_ANNOUNCEMENT, this.handleUserAnnouncement);
      pubsub.subscribe(pubsub.APP_STARTED, this.getOrcidUserInfo);
      pubsub.subscribe(pubsub.NAVIGATE, this.storeLatestPage);
      pubsub.subscribe(pubsub.CUSTOM_EVENT, this.onCustomEvent);
      this.setInitialVals();
      if (!this.model.get('timer')) {
        this.resetOrcidTimer();
      }
    },

    onCustomEvent: function (ev) {
      if (ev === 'orcid-action') {
        this.resetOrcidTimer();
      }
    },

    storeLatestPage: function (page) {
      // to know whether to orcid redirect
      this._latestPage = page;
    },

    resetOrcidTimer: function () {
      var timer = this.model.get('timer');
      var timeout = this.model.get('timeout');
      if (timer) {
        clearTimeout(timer);
      }

      // only start the timer if orcid mode is actually on
      if (this.model.get('orcidModeOn')) {
        timer = setTimeout(_.bind(this.toggleOrcidMode, this, false), timeout);
        this.model.set('timer', timer);
      }
    },

    viewEvents: {
      // dealing with authentication/user
      'navigate-login': function () {
        this._navigate('authentication-page', { subView: 'login' });
      },
      'navigate-register': function () {
        this._navigate('authentication-page', { subView: 'register' });
      },
      'navigate-settings': function () {
        this._navigate('UserPreferences');
      },

      'logout': function () {
        // log the user out of both the session and orcid
        this.getBeeHive().getObject('Session').logout();
        // log out of ORCID too
        this.orcidLogout();
      },

      'feedback-form-submit': 'submitForm',
      // dealing with orcid
      'navigate-to-orcid-link': 'navigateToOrcidLink',
      'user-change-orcid-mode': 'toggleOrcidMode',
      'logout-only-orcid': 'orcidLogout',
      'search-author': 'searchAuthor',
      'activate-recaptcha': 'activateRecaptcha'
    },

    submitForm: function ($form, $modal) {
      var data = $form.serialize();
      // record the user agent string
      data += '&user-agent-string=' + encodeURIComponent(navigator.userAgent);

      function beforeSend() {
        $form.find('button[type=submit]')
          .html('<i class="icon-loading"></i> Sending form...');
      }

      function done(data) {
        $form.find('button[type=submit]')
          .html('<i class="icon-success"></i> Message sent!');

        setTimeout(function () {
          $modal.modal('hide');
        }, 500);
      }

      function fail(err) {
        $form.find('button[type=submit]')
          .addClass('btn-danger')
          .html('<i class="icon-danger"></i> There was an error!');
      }

      var request = new ApiRequest({
        target: ApiTargets.FEEDBACK,
        options: {
          method: 'POST',
          data: data,
          dataType: 'json',
          done: done,
          fail: fail,
          beforeSend: beforeSend
        }

      });
      this.getBeeHive().getService('Api').request(request);
    },

    navigateToOrcidLink: function () {
      this._navigate('orcid-page');
    },

    _navigate: function (page, opts) {
      var pubsub = this.getPubSub();
      pubsub.publish(pubsub.NAVIGATE, page, opts);
    },

    // to set the correct initial values for signed in statuses
    setInitialVals: function () {
      var user = this.getBeeHive().getObject('User');
      var orcidApi = this.getBeeHive().getService('OrcidApi');
      var hasAccess = orcidApi.hasAccess();
      this.model.set({ orcidModeOn: user.isOrcidModeOn() && hasAccess, orcidLoggedIn: hasAccess });
      this.model.set('currentUser', user.getUserName());
    },

    getOrcidUserInfo: function () {
      var orcidApi = this.getBeeHive().getService('OrcidApi');
      // get the orcid username if applicable
      if (this.model.get('orcidLoggedIn')) {
        // set the orcid username into the model
        var that = this;
        orcidApi.getUserProfile()
          .done(function (profile) {
            var firstName = profile.getFirstName();
            var lastName = profile.getLastName();
            that.model.set('orcidFirstName', firstName);
            that.model.set('orcidLastName', lastName);
            that.model.set('orcidQueryName', lastName + ', ' + firstName);

            // this will always be available
            that.model.set('orcidURI', profile.getOrcid());
          });
      }

      // also set in the "hourly" flag
      var hourly = this.getBeeHive().getObject('AppStorage').getConfigCopy().hourly;
      this.model.set('hourly', hourly);
    },

    handleUserAnnouncement: function (msg, data) {
      var orcidApi = this.getBeeHive().getService('OrcidApi'),
        user = this.getBeeHive().getObject('User');

      if (msg == user.USER_SIGNED_IN) {
        this.model.set('currentUser', data);
      } else if (msg == user.USER_SIGNED_OUT) {
        this.model.set('currentUser', undefined);
      } else if (msg == user.USER_INFO_CHANGE && _.has(data, 'isOrcidModeOn')) {
        // every time this changes, we check for api access status
        this.model.set({ orcidModeOn: data.isOrcidModeOn, orcidLoggedIn: orcidApi.hasAccess() });

        if (this.model.get('orcidLoggedIn')) {
          this.getOrcidUserInfo();
        }
      }
    },

    // we don't want to respond to changes from pubsub or user object with this,
    // only changes that the user has initiated using the navbar widget,
    // otherwise things will be toggled incorrectly
    toggleOrcidMode: function (val) {
      var user = this.getBeeHive().getObject('User'),
        orcidApi = this.getBeeHive().getService('OrcidApi');

      var newVal = _.isBoolean(val) ? val : this.model.get('orcidModeOn');
      user.setOrcidMode(newVal);
      this.model.set('orcidModeOn', newVal);

      if (newVal) {
        // sign into orcid api if not signed in already
        if (!orcidApi.hasAccess()) {
          orcidApi.signIn();
        }
      }
      this.resetOrcidTimer();
    },

    searchAuthor: function () {
      var pubsub = this.getPubSub();
      pubsub.publish(pubsub.START_SEARCH, new ApiQuery(
        {
          q: 'author:' + this.qUpdater.quote(this.model.get('orcidQueryName'))
        }));
    },

    signOut: function () {
      var user = this.getBeeHive().getObject('User'),
        orcidApi = this.getBeeHive().getService('OrcidApi');

      if (orcidApi) orcidApi.signOut();

      user.setOrcidMode(false);
    },


    orcidLogout: function () {
      var pubsub = this.getPubSub();
      this.getBeeHive().getService('OrcidApi').signOut();
      // ned to set this explicitly since there is no event from the beehive
      this.model.set('orcidLoggedIn', false);
      this.getBeeHive().getObject('User').setOrcidMode(false);
      // finally, redirect if currently on orcid page
      if (this._latestPage === 'orcid-page') {
        pubsub.publish(pubsub.NAVIGATE, 'index-page');
      }
    },


    activateRecaptcha: function () {
      // right now, modal is not part of main view.$el because it has to be inserted at the bottom of the page
      var view = new Marionette.ItemView({ el: '#feedback-modal' });
      this.getBeeHive().getObject('RecaptchaManager').activateRecaptcha(view);
    }

  });

  return NavWidget;
});
