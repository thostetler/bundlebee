define([
  'page_managers/controller',
  'page_managers/one_column_view',
  'wraps/orcid-instructions-page-manager/orcid-instructions.html'
], function (
  PageManagerController,
  PageManagerView,
  PageManagerTemplate
) {
  var PageManager = PageManagerController.extend({

    createView: function (options) {
      options = options || {};
      options.template = PageManagerTemplate;
      return new PageManagerView({ template: PageManagerTemplate, className: 'orcid-info' });
    }
  });

  return PageManager;
});
