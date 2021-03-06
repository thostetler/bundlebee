define(['widgets/facet/factory'], function (FacetFactory) {
  return function () {
    var widget = FacetFactory.makeBasicCheckboxFacet({
      facetField: 'keyword_facet',
      facetTitle: 'Keywords',
      logicOptions: { single: ['limit to', 'exclude'], multiple: ['and', 'or', 'exclude'] }
    });
    return widget;
  };
});
