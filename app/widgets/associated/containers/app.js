define([
  'underscore',
  'react-redux',
  '../redux/modules/ui',
  '../components/app'
], function (_, ReactRedux, ui, App) {
  // actions
  const {
    handleLinkClick
  } = ui;

  // mapping state to props
  const mapStateToProps = state => ({
    loading: state.ui.loading,
    items: state.ui.items,
    hasError: state.ui.hasError
  });

  // dispatch to props
  const mapDispatchToProps = dispatch => ({
    handleLinkClick: link => dispatch(handleLinkClick(link))
  });

  return ReactRedux.connect(mapStateToProps, mapDispatchToProps)(App);
});
