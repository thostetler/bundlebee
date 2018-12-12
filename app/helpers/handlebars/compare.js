
define([], function () {
  return function(lvalue, rvalue, options) {
    var operators, result, operator;
    if (arguments.length < 3) {
      throw new Error("Handlebars Helper 'compare' needs 2 parameters");
    }

    if (options === undefined || !options.hash || !options.hash.operator) {
      operator = "===";
    } else {
      operator = options.hash.operator;
    }

    operators = {
      '==': function(l, r) { return l == r; },
      '===': function(l, r) { return l === r; },
      '!=': function(l, r) { return l != r; },
      '!==': function(l, r) { return l !== r; },
      '<': function(l, r) { return l < r; },
      '>': function(l, r) { return l > r; },
      '<=': function(l, r) { return l <= r; },
      '>=': function(l, r) { return l >= r; },
      'typeof': function(l, r) { return typeof l == r; }
    };
    if (!operators[operator]) {
      throw new Error("Handlebars Helper 'compare' doesn't know the operator " + operator);
    }
    result = operators[operator](lvalue, rvalue);
    if (result) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  }
});
