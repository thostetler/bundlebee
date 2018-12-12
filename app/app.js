define([
  'services/router',
  'components/application',
  'mixins/discovery_bootstrap',
  'styles/manifest.scss',
  'bootstrap-sass'
], function (Router, Application, Bootstrapper) {

  Application.prototype.shim();
  const app = window.app = new (Application.extend(Bootstrapper))({
    debug: true,
    timeout: 30000
  });

  app.registerModules({
    core: {
      controllers: {
        Orcid: require('modules/orcid/module'),
        QueryMediator: require('components/query_mediator'),
        AlertsController: require('wraps/alerts_mediator'),
        FeedbackMediator: require('wraps/discovery_mediator'),
      },
      services: {
        Api: require('services/api'),
        Navigator: require('services/navigator'),
        PubSub: require('services/pubsub'),
        PersistentStorage: require('services/storage'),
        HistoryManager: require('components/history_manager')
      },
      objects: {
        User: require('components/user'),
        AppStorage: require('components/app_storage'),
        DynamicConfig: require('discovery.vars'),
        MasterPageManager: require('page_managers/master'),
        Session: require('components/session'),
        DocStashController: require('components/doc_stash_controller'),
        LibraryController: require('components/library_controller'),
        CSRFManager: require('components/csrf_manager'),
        RecaptchaManager: require('components/recaptcha_manager'),
      }
    },
    widgets: {

      // pages
      // LandingPage: require('wraps/landing_page_manager/landing_page_manager'),
      // ErrorPage: require('wraps/error_page_manager/error_page_manager'),

      // widgets
      NavbarWidget: require('widgets/navbar/widget'),
      FooterWidget: require('widgets/footer/widget'),
      AlertsWidget: require('widgets/alerts/widget'),
      // NavbarWidget: require('widgets/navbar/widget'),
      // FooterWidget: require('widgets/footer/widget'),
      // AlertsWidget: require('widgets/alerts/widget'),
      // SearchWidget: require('widgets/search_bar/search_bar_widget'),
      // ClassicSearchForm: require('widgets/classic_form/widget'),
      // PaperSearchForm: require('widgets/paper_search_form/widget')
    }
  });
  const pb = app.getService('PubSub');
  const publish = _.partial(_.bind(pb.publish, pb), pb.getCurrentPubSubKey());
  publish(pb.APP_LOADED);
  app.configure();
  publish(pb.APP_STARTING);
  app.start(Router);

  publish(pb.APP_STARTED);
  app.bootstrap().done(function (config) {
    app.onBootstrap(config);
    publish(pb.APP_BOOTSTRAPPED);
  });

  console.log(app);
});
