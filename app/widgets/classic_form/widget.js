define([
  'widgets/base/base_widget',
  'components/api_query',
  'components/api_query_updater',
  'widgets/classic_form/form.html',
  'widgets/paper_search_form/topterms',
  'components/analytics',
  'jquery-ui/ui/widgets/autocomplete'
], function (
  BaseWidget,
  ApiQuery,
  ApiQueryUpdater,
  FormTemplate,
  AutocompleteData,
  analytics) {
  // for autocomplete
  function split(val) {
    return val.split(/,\s*/);
  }
  function extractLast(term) {
    return split(term).pop();
  }

  var FormView = Marionette.ItemView.extend({

    template: FormTemplate,

    className: 'classic-form',

    events: {
      'click button[type=submit]': 'submitForm',
      'input input': 'checkValid',
      'input textarea': 'checkValid',

    },

    checkValid: function () {
      var allVals = this.$('input[type=text], textarea').map(function () { return $(this).val(); }).get().join('');
      if (allVals) {
        this.$('button[type=submit]').prop('disabled', false);
      } else {
        this.$('button[type=submit]').prop('disabled', true);
      }
    },

    submitForm: function (e) {
      e.preventDefault();
      var queryDict = this.serializeClassic();
      if (!queryDict.q.length) {
        // allow searching of just dates (which is a filter)
        queryDict.q.push('*');
      }
      this.trigger('submit', queryDict);
      this.$('button[type=submit]').each(function () {
        var $el = $(this);
        var currHtml = $el.html();
        $el.html('<i class="icon-loading"/>  Loading...');
        setTimeout(function () {
          $el.html(currHtml);
        }, 3000);
      });
    },

    serializeClassic: function () {
      var qDict = { q: [], fq: [] },
        database,
        pubdateVals,
        dates,
        datestring,
        matchers;
      var pubdateDefaults = {
        month_from: '01',
        year_from: '0000',
        month_to: '12',
        year_to: '9999'
      };

      // database filters
      database = this.$('div[data-field=database] input:checked').map(
        function () { return $(this).attr('name'); }
      );

      if (database.length > 0) {
        var dbStr = database.length === 1 ? database[0] : '(astronomy or physics)';
        qDict.fq.push('database: ' + dbStr);
        qDict.fq.push('{!type=aqp v=$fq_database}');
        qDict.fq_database = 'database: ' + dbStr;
      }

      // article and prop refereed
      var property = this.$('div[data-field=property] input:checked').map(function () {
        return $(this).attr('name');
      });

      if (property.length > 0) {
        var str = property.length === 1 ? property[0] : '(refereed or notrefereed)';
        qDict.fq.push('property: ' + str);
        qDict.fq.push('{!type=aqp v=$fq_property}');
        qDict.fq_property = 'property: ' + str;
      }

      // date special case (it's also a filter, not a q)
      // do we need a pubdate entry in the first place?
      pubdateVals = this.$('div[data-field=date] input')
        .map(function () { return $(this).val(); }).get().join('');

      if (pubdateVals) {
        dates = this.$('div[data-field=date] input').map(function () {
          var $t = $(this);
          var val = $t.val() || pubdateDefaults[$t.attr('name')];
          return val;
        });

        datestring = '[' + dates[1] + '-' + dates[0] + ' TO ' + dates[3] + '-' + dates[2] + ']';
        qDict.q.push('pubdate:' + datestring);
      }


      matchers = {
        'default': /=?"[^"]+"|[=\w]+/g,
        'author': /.+/gm,
        'object': /.+/gm,
        'bibstem': /[^,^\s]+/g
      };

      // all input/textarea fields other than date
      this.$('div[data-textInput=true]').each(function () {
        var $t = $(this),
          logic,
          field,
          matcher,
          phrases,
          val = $t.find('input[type=text], textarea').val();

        if (val !== '') {
          logic = $t.find('.logic-group input:checked').val();
          field = $t.data('field');
          if (logic === 'BOOLEAN') {
            // create a new updater object
            var updater = new ApiQueryUpdater(' ');

            // expecting input to be on separate lines, with each proceeded by
            // a + or - symbol.
            // split the lines
            var lines = val.split(/(?:\n)/);

            // trim all the lines
            lines = $.map(lines, $.trim);

            /*
            transform each of the lines in a string
            +blah -> +"blah"
            -blah -> -"blah"
            blah -> +"blah"
            */
            val = lines.reduce(function (res, line) {
              // test the first character for presence of (+ or -)
              if (/[+\-]/.test(line[0])) {
                // +blah -> +"blah"
                line = line[0] + updater.quoteIfNecessary(line.slice(1)) + ' ';
              } else {
                // blah -> +"blah"
                line = '+' + updater.quoteIfNecessary(line) + ' ';
              }

              // add the built string to the result
              return res += line;
            }, '');

            qDict.q.push(field + ':(' + val.trim() + ')');
          } else {
            logic = ' ' + logic + ' ';
            if (matchers[field]) {
              matcher = matchers[field];
            } else {
              matcher = matchers.default;
            }
            phrases = val.match(matcher);

            phrases = _.filter(phrases, function (p) {
              return !/^(and|or)$/i.test(p);
            });

            // quote matches if field is author or object
            phrases = (field == 'author' || field == 'object')
              ? _.map(phrases, function (p) {
                // check for equal sign and wrap in quotes
                return /^[=\-+]/.test(p)
                  ? p.replace(/^([=\-+])(.*)/, '$1"$2"')
                  : p.replace(/^(.*)$/, '"$1"');
              }) : phrases;

            // use parentheses always (bc of = parsing issue)

            if (field === 'bibstem') {
              qDict.fq.push('{!type=aqp v=$fq_bibstem_facet}');
              qDict.fq_bibstem_facet = '(' + _.map(phrases, function (p) {
                return 'bibstem_facet:"' + p + '"';
              }).join(logic) + ')';
            } else {
              phrases = phrases.length > 1 ? phrases.join(logic) : phrases[0];
              qDict.q.push(field + ':(' + phrases + ')');
            }
          }
        }
      });
      return qDict;
    },

    onRender: function (e) {
      var getLastTerm = function (term) {
        return _.last(term.split(/(,\s|;\s|[,;])/));
      };
      this.$('input[name=bibstem]').autocomplete({
        minLength: 1,
        autoFocus: true,
        source: function (request, response) {
          var matches = $.map(AutocompleteData, function (item) {
            if (_.isString(request.term)) {
              var term = getLastTerm(request.term).toUpperCase();
              var bibstem = item.value.toUpperCase();
              var label = item.label.toUpperCase();
              if (
                bibstem.indexOf(term) === 0
                || label.indexOf(term) === 0
                || label.replace(/^THE\s/, '').indexOf(term) === 0
              ) {
                return item;
              }
            }
          });
          return response(matches);
        },
        focus: function () {
          // prevent value inserted on focus
          return false;
        },
        select: function (event, ui) {
          var terms = split(this.value);
          // remove the current input
          terms.pop();
          // add the selected item
          terms.push(ui.item.value);
          // add placeholder to get the comma-and-space at the end
          terms.push('');
          this.value = terms.join(', ');
          return false;
        }
      }).data('ui-autocomplete')._renderItem = function (ul, item) {
        var term = getLastTerm(this.term).toUpperCase().trim();
        var re = new RegExp('(' + term + ')', 'i');
        var label = item.label;
        if (term.length > 0) {
          label = label.replace(re,
            '<span class="ui-state-highlight">$1</span>'
          );
        }
        var $li = $('<li/>').appendTo(ul);
        $('<a/>').attr('href', '#').html(label).appendTo($li);
        return $li;
      };
    }
  });

  var FormWidget = BaseWidget.extend({

    initialize: function (options) {
      options = options || {};
      this.view = new FormView();
      this.listenTo(this.view, 'submit', this.submitForm);
    },

    activate: function (beehive) {
      this.setBeeHive(beehive);
    },

    onShow: function () {
      // clear the loading button
      this.view.$('button[type=submit]').each(function () {
        $(this).html('<i class="fa fa-search"></i> Search');
      });
      // set focus to author field
      this.view.$('#classic-author').focus();
    },

    submitForm: function (queryDict) {
      var newQuery = _.assign(queryDict, {
        q: queryDict.q.join(' '),
        sort: 'date desc'
      });

      newQuery = new ApiQuery(newQuery);
      this.getPubSub().publish(this.getPubSub().START_SEARCH, newQuery);

      analytics('send', 'event', 'interaction', 'classic-form-submit', JSON.stringify(queryDict));
    },

    // notify application to keep me around in memory indefinitely
    // this is so the form and anything the user has entered into it can stay around
    dontKillMe: true

  });

  return FormWidget;
});
