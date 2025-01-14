import Ember from 'ember';
import * as d3 from 'd3';
import { head, keys, last as lodashLast, map } from 'lodash-es';
import ChartComponent from './chart-component';

import LegendMixin from '../mixins/legend';
import TimeSeriesLabelerMixin from '../mixins/time-series-labeler';
import FloatingTooltipMixin from '../mixins/floating-tooltip';
import HasTimeSeriesRuleMixin from '../mixins/has-time-series-rule';
import AxesMixin from '../mixins/axes';
import FormattableMixin from '../mixins/formattable';
import NoMarginChartMixin from '../mixins/no-margin-chart';
import AxisTitlesMixin from '../mixins/axis-titles';

import { groupBy } from '../utils/group-by';
import { createBr, createSpan } from '../utils';

const TimeSeriesChartComponent = ChartComponent.extend(LegendMixin,
  TimeSeriesLabelerMixin, FloatingTooltipMixin, HasTimeSeriesRuleMixin,
  AxesMixin, FormattableMixin, NoMarginChartMixin, AxisTitlesMixin, {

  classNames: ['chart-time-series'],

  // ----------------------------------------------------------------------------
  // API -- inputs
  //
  // lineData, barData:
  // Both data sets need to be in the following format:
  // [{label: ..., time: ..., value: ...}, {...}, ...]
  // Line data will be grouped by label, while bar data is grouped by
  // time and then label
  //
  // ----------------------------------------------------------------------------
  lineData: null,
  barData: null,

  // ----------------------------------------------------------------------------
  // Time Series Chart Options
  // ----------------------------------------------------------------------------

  // Getters for formatting human-readable labels from provided data
  formatTime: d3.time.format('%Y-%m-%d'),
  formatTimeLong: d3.time.format('%a %b %-d, %Y'),

  // Data without group will be merged into a group with this name
  ungroupedSeriesName: 'Other',

  // Use basis interpolation? Smooths lines but may prevent extrema from being
  // displayed
  interpolate: false,

  // Force the Y axis to start at zero, instead of the smallest Y value provided
  yAxisFromZero: false,

  // Space between bars, as fraction of total bar + padding space
  barPadding: 0,

  // Space between bar groups, as fraction of total bar + padding space
  barGroupPadding: 0.25,

  // Bar left offset, as fraction of width of bar
  barLeftOffset: 0.0,

  // Force X-Axis labels to print vertically
  xAxisVertLabels: false,

  willDestroyElement: function() {
    this._removeMouseEventListeners();

    this._super(...arguments);
  },

  // ----------------------------------------------------------------------------
  // Time Series Chart Constants
  // ----------------------------------------------------------------------------

  // The default maximum number of labels to use along the x axis for a dynamic
  // x axis.
  DEFAULT_MAX_NUMBER_OF_LABELS: 10,

  // ----------------------------------------------------------------------------
  // Overrides of ChartComponent methods
  // ----------------------------------------------------------------------------

  // Combine all data for testing purposes
  finishedData: Ember.computed('_groupedLineData.@each.values', '_groupedBarData.[]', function() {
    return {
      lineData: this.get('_groupedLineData'),
      groupedBarData: this.get('_groupedBarData')
    };
  }),

  hasNoData: Ember.computed('_hasBarData', '_hasLineData', function() {
    return !this.get('_hasBarData') && !this.get('_hasLineData');
  }),

  // ----------------------------------------------------------------------------
  // Overrides of Legend methods
  // ----------------------------------------------------------------------------

  // ----------------------------------------------------------------------------
  // Data
  // ----------------------------------------------------------------------------

  _getLabelOrDefault: function(datum) {
    return datum.label && datum.label.toString() || this.get('ungroupedSeriesName');
  },

  // Puts lineData in a new format.
  // Resulting format is [{group: ..., values: ...}] where values are the
  // lineData values for that group.
  _groupedLineData: Ember.computed('lineData.[]', 'ungroupedSeriesName', function() {
    var lineData = this.get('lineData');
    if (Ember.isEmpty(lineData)) {
      return [];
    }

    var groups = groupBy(lineData, (datum) => {
      return this._getLabelOrDefault(datum);
    });

    return map(groups, function(values, groupName) {
      return {
        group: groupName,
        values: values
      };
    });
  }),

  // puts barData in a new format.
  // Resulting format: [[{group: ..., time: ..., value: ..., label:
  // ...}, ...], [...]] where each internal array is an array of hashes
  // at the same time
  _groupedBarData: Ember.computed('barData.[]', 'ungroupedSeriesName', 'barLeftOffset', function() {
    var barData = this.get('barData');
    if (Ember.isEmpty(barData)) {
      return [];
    }

    // returns map from time to array of bar hashes
    var barTimes = groupBy(barData, function(d) {
      return d.time.getTime();
    });

    return map(barTimes, (groups) => {
      return map(groups, (g) => {
          var label = this._getLabelOrDefault(g);
          var labelTime = g.time;
          var drawTime = this._transformCenter(g.time);
          return {
              group: label,
              time: drawTime,
              value: g.value,
              label: label,
              labelTime: labelTime
          };
      });
    });
  }),

  // Transforms the center of the bar graph for the drawing based on the
  // specified barLeftOffset
  _transformCenter: function(time) {
    // Transform Center is designed to offset Bar graphs against the labels on
    // the x axis.  That offset is based on the time unit selected.  This means
    // that a graph might have a selectedInterval of Months, but that the bars
    // are based on Weeks.  So if you were to shift a bar 1/2 of an interval it
    // would move 15 days instead of 15 weeks.  The fix is to check to see if
    // the bars are of a different interval first, before defaulting to the
    // selectedInterval
    var interval = this.get('computedBarInterval') || this.get('selectedInterval');
    var delta = this._getTimeDeltaFromInterval(interval);
    var offset = this.get('barLeftOffset');
    if (offset !== 0) {
      time = this._padTimeWithIntervalMultiplier(time, delta, offset);
    }
    return time;
  },

  // Since selected interval and time delta don't use the same naming convention
  // this converts the selected interval to the time delta convention for the
  // padding functions.
  _getTimeDeltaFromInterval: function(interval) {
    switch (interval) {
      case 'years':
      case 'Y':
        return 'year';
      case 'quarters':
      case 'Q':
        return 'quarter';
      case 'months':
      case 'M':
        return 'month';
      case 'weeks':
      case 'W':
        return 'week';
      case 'seconds':
      case 'S':
        return 'second';
    }
  },

  // Given a time, returns the time plus half an interval
  _padTimeForward: function(time, delta) {
    return this._padTimeWithIntervalMultiplier(time, delta, 0.5);
  },

  // Given a time, returns the time minus half an interval
  _padTimeBackward: function(time, delta) {
    return this._padTimeWithIntervalMultiplier(time, delta, -0.5);
  },

  // Because of the complexities of what will and won't work with this method,
  // it's not very safe to call. Instead, call _padTimeForward or
  // _padTimeBackward. This method exists to remove code duplication from those.
  _padTimeWithIntervalMultiplier: function(time, delta, multiplier) {
    if (time != null) {
      var intervalType = delta === 'quarter' ? 'month' : delta;
      var period = delta === 'quarter' ? 3 : 1;
      var offsetDelta = d3.time[intervalType].offset(time, period) - time.getTime();
      time = offsetDelta * multiplier + time.getTime();
    }
    return new Date(time);
  },

  // We'd like to have the option of turning our labels vertical when circumstances
  // require.  This function gets ALL the labels of the xAxis and rotates them.
  _rotateXAxisLabels: function() {
    var gXAxis = this.get('xAxis');

    // If we have a legend it'll take care of the margin bottom adjustments,
    // else we need to give ourselves some more room for the labels.
    if (!this.get('hasLegend')) {
      this.set('marginBottom', 20);
    }

    gXAxis.selectAll('text')
      .attr("y", 8)
      .attr("x", -8)
      .attr("dy", ".2em")
      .attr("transform", "rotate(-60)")
      .style("text-anchor", "end");

    // we also need to mod the legend top padding
    this.set('legendTopPadding', 30);
  },

  // Now that we can get our labels all turny, I actually need to straighten them
  // out if the feature is toggled
  _straightenXAxisLabels: function() {
    var gXAxis = this.get('xAxis');
    // most of these values are static and come from various places, including
    // the bowels of D3
    gXAxis.selectAll('text')
      .attr("y", 9)
      .attr("x", 0)
      .attr("dy", "0.71em")
      .attr("transform", null)
      .style("text-anchor", "middle");
  },

  _barGroups: Ember.computed('barData.[]', 'ungroupedSeriesName', function() {
    var barData = this.get('barData');
    if (Ember.isEmpty(barData)) {
      return [];
    }

    var barGroups = groupBy(barData, (datum) => {
      return this._getLabelOrDefault(datum);
    });
    return keys(barGroups);
  }),

  _hasLineData: Ember.computed.notEmpty('lineData'),

  _hasBarData: Ember.computed.notEmpty('barData'),

  // ----------------------------------------------------------------------------
  // Layout
  // ----------------------------------------------------------------------------

  // position of the left of the graphic -- we want to leave space for
  // labels
  graphicLeft: Ember.computed.alias('labelWidthOffset'),

  // width of the graphic
  graphicWidth: Ember.computed('width', 'graphicLeft', function() {
    return this.get('width') - this.get('graphicLeft');
  }),

  graphicHeight: Ember.computed('height', 'legendHeight', 'legendChartPadding', 'marginBottom', function() {
    var legendSize = this.get('legendHeight') + this.get('legendChartPadding') + (this.get('marginBottom') || 0);
    return this.get('height') - legendSize;
  }),

  // ----------------------------------------------------------------------------
  // Grouped/Stacked Bar Scales
  // ----------------------------------------------------------------------------

  // Unit of time between bar samples
  timeDelta: Ember.computed('_groupedBarData', function() {
    var groupedBarData = this.get('_groupedBarData');
    if (Ember.isEmpty(groupedBarData) || (groupedBarData.length < 2)) {
      return 'month';
    }

    // difference in time between first bar data group and second bar
    // data group
    var firstBarTime = groupedBarData[0][0].time;
    var secondBarTime = groupedBarData[1][0].time;
    var oneDayInSeconds = 24*60*60*1000;
    var diffTimeDays = (secondBarTime - firstBarTime) / (oneDayInSeconds);

    // Some fuzzy bar interval computation, I just picked 2 day buffer
    if (diffTimeDays > 351) {
      return 'year';
    } else if (diffTimeDays > 33) {
      return 'quarter';
    } else if (diffTimeDays > 9) {
      return 'month';
    } else if (diffTimeDays > 3) {
      return 'week';
    } else {
      return 'day';
    }
  }),

  // this method seems very flaky to me; making padding by changing domain
  // convention is to change range
  barDataExtent: Ember.computed('timeDelta', '_groupedBarData.[]', function() {
    var timeDelta = this.get('timeDelta');
    var groupedBarData = this.get('_groupedBarData');
    if (Ember.isEmpty(groupedBarData)) {
      return [new Date(), new Date()];
    }

    var first = head(groupedBarData);
    var last = lodashLast(groupedBarData);
    var startTime = new Date(first[0].time);
    var endTime = new Date(last[0].time);

    // Add the padding needed for the edges of the bar
    var paddedStart = this._padTimeBackward(startTime, timeDelta);
    var paddedEnd = this._padTimeForward(endTime, timeDelta);
    return [ new Date(paddedStart), new Date(paddedEnd) ];
  }),

  // The time range over which all bar groups are drawn
  xBetweenGroupDomain: Ember.computed.alias('barDataExtent'),

  // The range of labels assigned within each group
  xWithinGroupDomain: Ember.computed.alias('_barGroups'),

  // The space (in pixels) allocated to each bar, including padding
  barWidth: Ember.computed('xGroupScale', function() {
    return this.get('xGroupScale').rangeBand();
  }),

  paddedGroupWidth: Ember.computed('timeDelta', 'xTimeScale', 'xBetweenGroupDomain', function() {
    var timeDelta = this.get('timeDelta');
    var scale = this.get('xTimeScale');
    var t1 = this.get('xBetweenGroupDomain')[0];
    var t2 = (timeDelta === 'quarter') ? d3.time['month'].offset(t1, 3) : d3.time[timeDelta].offset(t1, 1);
    return scale(t2) - scale(t1);
  }),
  // ----------------------------------------------------------------------------
  // Line Drawing Scales
  // ----------------------------------------------------------------------------

  lineSeriesNames: Ember.computed('_groupedLineData', function() {
    var data = this.get('_groupedLineData');
    if (Ember.isEmpty(data)) {
      return [];
    }
    return data.map(function(d) {
      return d.group;
    });
  }),

  lineDataExtent: Ember.computed('_groupedLineData.@each.values', function() {
    var data = this.get('_groupedLineData');
    if (Ember.isEmpty(data)) {
      return [new Date(), new Date()];
    }

    var extents = map(data, 'values').map(function(series) {
      return d3.extent(series.map(function(d) {
        return d.time;
      }));
    });

    return [
      d3.min(extents, function(e) {
        return e[0];
      }),
      d3.max(extents, function(e) {
        return e[1];
      })
    ];
  }),

  // The set of all time series
  xBetweenSeriesDomain: Ember.computed.alias('lineSeriesNames'),

  // The range of all time series
  xWithinSeriesDomain: Ember.computed.alias('lineDataExtent'),

  // ----------------------------------------------------------------------------
  // Ticks and Scales
  // ----------------------------------------------------------------------------

  // If there is a dynamic x axis, then assume the value that it is given,
  // and if it is not a dynamic x axis, set it to the number of x axis ticks.
  //
  // For a dynamic x axis, let the max number of labels be the minimum of
  // the number of x ticks and the assigned value. This is to prevent
  // the assigned value from being so large that labels flood the x axis.
  maxNumberOfLabels: Ember.computed('numXTicks', 'dynamicXAxis', 'maxNumberOfRotatedLabels', 'xAxisVertLabels', {
    get() {
      var allowableTicks = this.get('numXTicks');
      if (this.get('xAxisVertLabels')) {
        allowableTicks = this.get('maxNumberOfRotatedLabels');
      }

      if (this.get('dynamicXAxis')) {
        return Math.min(this.get('DEFAULT_MAX_NUMBER_OF_LABELS'), allowableTicks);
      } else {
        return allowableTicks;
      }
    },
    set(key, value) {
      var allowableTicks = this.get('numXTicks');
      if (this.get('xAxisVertLabels')) {
        allowableTicks = this.get('maxNumberOfRotatedLabels');
      }

      if (this.get('dynamicXAxis')) {
        if (isNaN(value)) {
          value = this.get('DEFAULT_MAX_NUMBER_OF_LABELS');
        }
        return Math.min(value, allowableTicks);
      } else {
        return allowableTicks;
      }
    }
  }),

  // The footprint of a label rotated at -60 transform
  maxNumberOfRotatedLabels: Ember.computed('_innerTickSpacingX', 'graphicWidth', 'numXTicks', function() {
    const radianVal = 30 * (Math.PI / 180);
    const tickSpacing = Math.sin(radianVal) * this.get('_innerTickSpacingX');
    const numOfTicks = Math.floor(this.get('graphicWidth') / tickSpacing);

    return Math.max(numOfTicks, this.get('numXTicks'));
  }),

  // Create a domain that spans the larger range of bar or line data
  xDomain: Ember.computed('xBetweenGroupDomain', 'xWithinSeriesDomain',
    '_hasBarData', '_hasLineData', 'maxNumberOfLabels', function() {
    if (!this.get('_hasBarData')) {
      return this.get('xWithinSeriesDomain');
    }
    if (!this.get('_hasLineData')) {
      return this.get('xBetweenGroupDomain');
    }
    var minOfGroups = this.get('xBetweenGroupDomain')[0];
    var maxOfGroups = this.get('xBetweenGroupDomain')[1];
    var minOfSeries = this.get('xWithinSeriesDomain')[0];
    var maxOfSeries = this.get('xWithinSeriesDomain')[1];

    return [ Math.min(minOfGroups, minOfSeries), Math.max(maxOfGroups, maxOfSeries) ];
  }),

  // Largest and smallest values in line and bar data
  // Use raw bar data instead of doubly grouped hashes in groupedBarData
  yDomain: Ember.computed( '_groupedLineData', '_groupedBarData',
    '_hasBarData', '_hasLineData', 'yAxisFromZero', function() {

    var lineData = this.get('_groupedLineData');
    var groupData = this.get('_groupedBarData');

    var maxOfSeries = d3.max(lineData, function(d) {
      return d3.max(d.values, function(dd) {
        return dd.value;
      });
    });

    var minOfSeries = d3.min(lineData, function(d) {
      return d3.min(d.values, function(dd) {
        return dd.value;
      });
    });

    var maxOfGroups = d3.max(groupData, function(d) {
      return d3.max(d, function(dd) {
        return dd.value;
      });
    });

    var minOfGroups = d3.min(groupData, function(d) {
      return d3.min(d, function(dd) {
        return dd.value;
      });
    });

    var hasBarData = this.get('_hasBarData');
    var hasLineData = this.get('_hasLineData');

    // Find the extent of whatever data is drawn on the graph,
    // e.g. max of only line data, or max of line
    var min, max;
    if (!hasBarData) {
      min = minOfSeries;
      max = maxOfSeries;
    } else if (!hasLineData) {
      min = minOfGroups;
      max = maxOfGroups;
    } else {
      min = Math.min(minOfGroups, minOfSeries);
      max = Math.max(maxOfGroups, maxOfSeries);
    }

    // Ensure the extent contains zero if that is desired. If all values in
    // the y-domain are equal, assign it a range so data can be displayed
    if (this.get('yAxisFromZero') || min === max) {
      if (max < 0) {
        return [min, 0];
      }
      if (min > 0) {
        return [0, max];
      }
      if ((min === max && max === 0)) {
        return [-1, 1];
      }
    }

    return [min, max];
  }),

  yRange: Ember.computed('graphicTop', 'graphicHeight', function() {
    return [
      this.get('graphicTop') + this.get('graphicHeight'),
      this.get('graphicTop')
    ];
  }),

  yScale: Ember.computed('yDomain', 'yRange', 'numYTicks', function() {
    return d3.scale.linear()
      .domain(this.get('yDomain'))
      .range(this.get('yRange'))
      .nice(this.get('numYTicks'));
  }),

  xRange: Ember.computed( 'graphicLeft', 'graphicWidth', function() {
    return [
      this.get('graphicLeft'),
      this.get('graphicLeft') + this.get('graphicWidth')
    ];
  }),

  xTimeScale: Ember.computed('xDomain', 'xRange', function() {
    return d3.time.scale()
      .domain(this.get('xDomain'))
      .range(this.get('xRange'));
  }),

  xGroupScale: Ember.computed('xWithinGroupDomain', 'paddedGroupWidth',
    'barPadding', 'barGroupPadding', function() {
    return d3.scale.ordinal()
      .domain(this.get('xWithinGroupDomain'))
      .rangeRoundBands([ 0, this.get('paddedGroupWidth')],
        this.get('barPadding')/2, this.get('barGroupPadding')/2);
  }),

  // Override axis mix-in min and max values to listen to the scale's domain
  minAxisValue: Ember.computed('yScale', function() {
    var yScale = this.get('yScale');
    return yScale.domain()[0];
  }),

  maxAxisValue: Ember.computed('yScale', function() {
    var yScale = this.get('yScale');
    return yScale.domain()[1];
  }),

  // ----------------------------------------------------------------------------
  // Tooltip Configuration
  // ----------------------------------------------------------------------------

  showDetails: Ember.computed('isInteractive', function() {
    if (!this.get('isInteractive')) {
      return Ember.K;
    }

    return (data, i, element) => {
      d3.select(element).classed('hovered', true);

      var time = data.labelTime != null ? data.labelTime : data.time;
      time = this.adjustTimeForShowDetails(time);
      var content = createSpan();
      content.appendChild(createSpan(this.get('formatTime')(time), ['tip-label']));
      this.showTooltip(content.outerHTML, d3.event);
      var formatLabelFunction = this.get('formatLabelFunction');

      var addValueLine = function(d) {
        var name = createSpan(d.group + ': ', ['name']);
        var value = createSpan(formatLabelFunction(d.value), ['value']);
        content.append(name);
        content.append(value);
        content.append(createBr());
      };

      if (Ember.isArray(data.values)) {
        data.values.forEach(addValueLine);
      } else {
        addValueLine(data);
      }

      return this.showTooltip(content.outerHTML, d3.event);
    };
  }),

  hideDetails: Ember.computed('isInteractive', function() {
    if (!this.get('isInteractive')) {
      return Ember.K;
    }

    return (data, i, element) => {
      d3.select(element).classed('hovered', false);
      return this.hideTooltip();
    };
  }),

  /**
   * This is a convience method that allows users to overide the time returned
   * for the showDetails labels.  Some users might want to nudge or round the
   * date to create a cleaner details label for their user.
   * @param  {Date} time
   * @return {Date} The altered input object
   */
  adjustTimeForShowDetails: function(time) {
    return time;
  },

  // ----------------------------------------------------------------------------
  // Styles
  // ----------------------------------------------------------------------------

  // Number of pixels to shift graphics away from origin line
  zeroDisplacement: 1,

  groupAttrs: Ember.computed('paddedGroupWidth', function() {
    return {
      transform: () => "translate(" + (-this.get('paddedGroupWidth') / 2) + ",0)"
    };
  }),

  groupedBarAttrs: Ember.computed( 'xTimeScale', 'xGroupScale', 'barWidth', 'yScale',
    'zeroDisplacement', 'barLeftOffset', function() {

    var xTimeScale = this.get('xTimeScale');
    var xGroupScale = this.get('xGroupScale');
    var yScale = this.get('yScale');
    var zeroDisplacement = this.get('zeroDisplacement');

    return {
      class: function(d, i) {
        return "grouping-" + i;
      },

      'stroke-width': 0,
      width: this.get('barWidth'),
      x: function(d) {
        return xGroupScale(d.label) + xTimeScale(d.time);
      },

      y: function(d) {
        return d.value > 0 ? yScale(d.value) : yScale(0) + zeroDisplacement;
      },

      height: function(d) {
        // prevent zero-height bars from causing errors because of zeroDisplacement
        var zeroLine = Math.max(0, yScale.domain()[0]);
        return Math.max(0, Math.abs(yScale(zeroLine) - yScale(d.value)) - zeroDisplacement);
      }
    };
  }),

  line: Ember.computed( 'xTimeScale', 'yScale', 'interpolate', function() {
    return d3.svg.line()
      .x((d) => this.get('xTimeScale')(d.time))
      .y((d) => this.get('yScale')(d.value))
      .interpolate(this.get('interpolate') ? 'basis' : 'linear');
  }),

  // Line styles. Implements Craig's design spec, which ensures that out of the
  // first six lines, there are always two distinguishing styles between every
  // pair of lines.
  // 1st line: ~2px, base color, solid
  // 2nd line: ~1px, 66% tinted, solid
  // 3rd line: ~2px, base color, dotted
  // 4th line: ~1px, 66% tinted, dotted
  // 5th line: ~3px, 33% tinted, solid
  // 6th line: ~3px, 33% tinted, dotted
  get lineColorFn() {
    return (d, i) => {
      var ii;
      switch (i) {
        case 0:
          ii = 0;
          break;
        case 1:
          ii = 2;
          break;
        case 2:
          ii = 0;
          break;
        case 3:
          ii = 2;
          break;
        case 4:
          ii = 0;
          break;
        case 5:
          ii = 1;
          break;
        default:
          ii = i;
      }
      return this.get('getSeriesColor')(d, ii);
    };
  },

  lineAttrs: Ember.computed('line', 'getSeriesColor', function() {
    return {
        class: (d, i) => "line series-" + i,
        d: (d) => this.get('line')(d.values),
        stroke: this.get('lineColorFn'),
        'stroke-width': function(d, i) {
          switch (i) {
            case 0:
              return 2;
            case 1:
              return 1.5;
            case 2:
              return 2;
            case 3:
              return 1.5;
            case 4:
              return 2.5;
            case 5:
              return 2.5;
            default:
              return 2;
          }
        },

        'stroke-dasharray': function(d, i) {
          switch (i) {
              case 2:
              case 3:
              case 5:
                return '2,2';
              default:
                return '';
          }
        }
    };
  }),

  // ----------------------------------------------------------------------------
  // Color Configuration
  // ----------------------------------------------------------------------------

  numLines: Ember.computed.alias('xBetweenSeriesDomain.length'),
  numBarsPerGroup: Ember.computed.alias('xWithinGroupDomain.length'),

  numColorSeries: 6, // Ember.computed.alias 'numLines'
  numSecondaryColorSeries: Ember.computed.alias('numBarsPerGroup'),

  // Use primary colors for bars if there are no lines

  secondaryMinimumTint: Ember.computed('numLines', function() {
    return this.get('numLines') === 0 ? 0.0 : 0.4;
  }),

  secondaryMaximumTint: Ember.computed( 'numLines', function() {
    return this.get('numLines') === 0 ? 0.8 : 0.85;
  }),

  // ----------------------------------------------------------------------------
  // Legend Configuration
  // ----------------------------------------------------------------------------

  hasLegend: Ember.computed( 'legendItems.length', 'showLegend', function() {
    return this.get('legendItems.length') > 1 && this.get('showLegend');
  }),

  legendItems: Ember.computed('xBetweenSeriesDomain', 'xWithinGroupDomain',
    'getSeriesColor', 'getSecondarySeriesColor', function() {

    // getSeriesColor = this.get('getSeriesColor');
    // lineAttrs = this.get('lineAttrs');

    var result = this.get('xBetweenSeriesDomain').map((d, i) => {
      // Line legend items
      var res = {
        label: d,
        stroke: this.get('lineAttrs')['stroke'](d, i),
        width: this.get('lineAttrs')['stroke-width'](d, i),
        dotted: this.get('lineAttrs')['stroke-dasharray'](d, i),
        icon: () => 'line',
        selector: ".series-" + i
      };
      return res;
    }).concat(this.get('xWithinGroupDomain').map((d, i) => {
      // Bar legend items
      var color = this.get('getSecondarySeriesColor')(d, i);
      var res = {
        stroke: color,
        fill: color,
        label: d,
        icon: () => 'square',
        selector: (".grouping-" + i)
      };
      return res;
    }));
    return result;
  }),

  // ----------------------------------------------------------------------------
  // Selections
  // ----------------------------------------------------------------------------

  removeAllGroups: function() {
    this._removeMouseEventListeners();
    this.getViewportBars().remove();
  },

  _removeMouseEventListeners: function() {
    if(this._hasMouseEventListeners) {
      let viewportBars = this.getViewportBars();
      let bars = viewportBars.selectAll('rect');
      bars.on('mouseover', null);
      bars.on('mouseout', null);
    }
  },

  getViewportBars() {
    return this.get('viewport').selectAll('.bars');
  },

  get groups() {
    return this.getViewportBars().data(this.get('_groupedBarData'));
  },

  removeAllSeries: function() {
    this.get('viewport').selectAll('.series').remove();
  },

  get series() {
    return this.get('viewport').selectAll('.series').data(this.get('_groupedLineData'));
  },

  get xAxis() {
    var xAxis = this.get('viewport').select('.x.axis');
    if (xAxis.empty()) {
      return this.get('viewport')
        .insert('g', ':first-child')
        .attr('class', 'x axis');
    } else {
      return xAxis;
    }
  },

  get yAxis() {
    var yAxis = this.get('viewport').select('.y.axis');
    if (yAxis.empty()) {
      return this.get('viewport')
        .insert('g', ':first-child')
        .attr('class', 'y axis');
    } else {
      return yAxis;
    }
  },

  // ----------------------------------------------------------------------------
  // Drawing Functions
  // ----------------------------------------------------------------------------

  renderVars: [
    'barLeftOffset',
    'labelledTicks',
    'xGroupScale',
    'xTimeScale',
    'yScale',
    'xValueDisplayName',
    'yValueDisplayName',
    'hasAxisTitles', // backward compatibility support.
    'hasXAxisTitle',
    'hasYAxisTitle',
    'xTitleHorizontalOffset',
    'yTitleVerticalOffset',
    'xAxisVertLabels',
    'maxNumberOfMinorTicks',
    'graphicWidth'
  ],

  drawChart: function() {
    this.updateBarData();
    this.updateLineData();
    this.updateLineMarkers();
    this.updateAxes();
    this.updateBarGraphic();
    this.updateLineGraphic();
    this.updateAxisTitles();
    if (this.get('hasLegend')) {
      this.drawLegend();
    } else {
      this.clearLegend();
    }
  },

  updateAxes: function() {
    var xAxis = d3.svg.axis()
      .scale(this.get('xTimeScale'))
      .orient('bottom')
      .tickValues(this.get('labelledTicks'))
      .tickFormat(this.get('formattedTime'))
      .tickSize(6, 3);

    var graphicTop = this.get('graphicTop');
    var graphicHeight = this.get('graphicHeight');
    var gXAxis = this.get('xAxis');

    // Put our x-axis in the right place
    gXAxis.attr({
      transform: "translate(0," + graphicTop + graphicHeight + ")"
    }).call(xAxis);

    // If we have minor ticks, this will select the applicable labels and alter
    // them
    this.filterMinorTicks();

    // Do we need to turn our axis labels?
    if (this.get('xAxisVertLabels')) {
      this._rotateXAxisLabels();
    } else {
      this._straightenXAxisLabels();
    }

    //tickSize draws the Y-axis allignment line across the whole of the graph.
    var yAxis = d3.svg.axis()
      .scale(this.get('yScale'))
      .orient('right')
      .ticks(this.get('numYTicks'))
      .tickSize(this.get('graphicWidth'))
      .tickFormat(this.get('formatValueAxis'));

    var gYAxis = this.get('yAxis');

    // find the correct size of graphicLeft in order to fit the Labels perfectly
    this.set('graphicLeft', this.maxLabelLength(gYAxis.selectAll('text')) + this.get('labelPadding'));

    var graphicLeft = this.get('graphicLeft');
    gYAxis.attr('transform', "translate(" + graphicLeft + ",0)")
      .call(yAxis);

    // Ensure ticks other than the zeroline are minor ticks
    gYAxis.selectAll('g')
      .filter(function(d) { return d; })
      .classed('major', false)
      .classed('minor', true);

    gYAxis.selectAll('text')
      .style('text-anchor', 'end')
      .attr({ x: -this.get('labelPadding') });
  },

  updateBarData: function() {
    // Always remove the previous bars, this allows us to maintain the
    // rendering order of bars behind lines
    this.removeAllGroups();

    var groups = this.get('groups');
    var showDetails = this.get('showDetails');
    var hideDetails = this.get('hideDetails');
    this._hasMouseEventListeners = true;

    // Ensure bars are always inserted behind lines
    groups.enter()
      .insert('g', '.series')
      .attr('class', 'bars');
    groups.exit().remove();

    var bars = groups.selectAll('rect').data(function(d) { return d; });
    bars.enter().append('rect')
      .on("mouseover", function(d, i) {
        return showDetails(d, i, this);
      })
      .on("mouseout", function(d, i) {
        return hideDetails(d, i, this);
      });
    bars.exit().remove();
  },

  updateBarGraphic: function() {
    var groups = this.get('groups');
    groups.attr(this.get('groupAttrs'));
    groups.selectAll('rect')
      .style('fill', this.get('getSecondarySeriesColor'))
      .attr(this.get('groupedBarAttrs'));
  },

  updateLineData: function() {
    // Always remove the previous lines, this allows us to maintain the
    // rendering order of bars behind lines
    this.removeAllSeries();

    var series = this.get('series');

    series.enter()
      .append('g').attr('class', 'series')
      .append('path').attr('class', 'line');

    series.exit()
      .remove();
  },

  updateLineGraphic: function() {
    var series = this.get('series');
    var graphicTop = this.get('graphicTop');
    series.attr('transform', "translate(0, " + graphicTop + ")");
    return series.select('path.line')
      .attr(this.get('lineAttrs'));
  }
});

export default TimeSeriesChartComponent;
