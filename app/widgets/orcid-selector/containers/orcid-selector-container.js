
define([
  'underscore',
  'react',
  'redux',
  'react-redux',
  '../redux/modules/orcid-selector-app',
  '../components/orcid-selector-app'
], function (_, React, Redux, ReactRedux, actions, OrcidSelectorApp) {
  // actions
  const {
    sendEvent
  } = actions;

  // mapping state to props
  const mapStateToProps = state => ({
    app: state.get('OrcidSelectorApp') // state is available on sub-components as 'app'
  });

  // dispatch to props
  const mapDispatchToProps = dispatch => ({
    onClaim: () => dispatch(sendEvent('orcid-bulk-claim')),
    onDelete: () => dispatch(sendEvent('orcid-bulk-delete')),
    onUpdate: () => dispatch(sendEvent('orcid-bulk-update'))
  });

  return ReactRedux.connect(mapStateToProps, mapDispatchToProps)(OrcidSelectorApp);
});
