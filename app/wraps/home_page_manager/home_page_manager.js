define([
  'page_managers/toc_controller',
  'page_managers/three_column_view',
  'wraps/home_page_manager/home-page-layout.html',
  'wraps/home_page_manager/home-nav.html'
], function (
  PageManagerController,
  PageManagerView,
  PageManagerTemplate,
  TOCTemplate
) {
  var PageManager = PageManagerController.extend({

    TOCTemplate: TOCTemplate,

    createView: function (options) {
      options = options || {};
      options.template = options.template || PageManagerTemplate;
      return new PageManagerView({ template: PageManagerTemplate, className: 's-home-layout s-100-height', id: 'home-layout' });
    },

    navConfig: [],


  });
  return PageManager;
});
