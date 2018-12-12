
define([
  'underscore',
  'react',
  'redux',
  'react-redux',
  '../redux/modules/sort-app',
  '../components/sort-app'
], function (_, React, Redux, ReactRedux, actions, SortApp) {
  // actions
  const {
    setSort,
    setDirection
  } = actions;

  // mapping state to props
  const mapStateToProps = state => ({
    app: state.get('SortApp') // state is available on sub-components as 'app'
  });

  // dispatch to props
  const mapDispatchToProps = dispatch => ({
    setSort: value => dispatch(setSort(value)),
    setDirection: () => dispatch(setDirection())
  });

  return ReactRedux.connect(mapStateToProps, mapDispatchToProps)(SortApp);
});
