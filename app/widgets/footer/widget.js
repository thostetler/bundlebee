define([
  'widgets/footer/footer.html'
], function (
  FooterTemplate
) {
  var Footer = Marionette.ItemView.extend({
    template: FooterTemplate,
    className: 'footer s-footer'
  });

  return Footer;
});
