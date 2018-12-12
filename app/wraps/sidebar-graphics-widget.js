define([
  'widgets/graphics/widget'

], function (
  GraphicsWidget

) {
  var options = { sidebar: true };

  return function () {
    return new GraphicsWidget(options);
  };
});
