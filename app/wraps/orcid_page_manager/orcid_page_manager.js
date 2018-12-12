define([
  'page_managers/controller',
  'page_managers/one_column_view',
  'wraps/orcid_page_manager/orcid-page-layout.html'
], function (
  PageManagerController,
  PageManagerView,
  PageManagerTemplate) {
  var PageManager = PageManagerController.extend({

    createView: function (options) {
      options = options || {};
      options.template = PageManagerTemplate;
      return new PageManagerView({ template: PageManagerTemplate, className: 's-orcid-layout', id: 'orcid-page-layout' });
    }
  });

  return PageManager;
});
