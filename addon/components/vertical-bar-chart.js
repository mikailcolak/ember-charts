import Ember from 'ember';
import * as d3 from 'd3';
import { assign, each, flatten, groupBy as lodashGroupBy, keys, map, max as lodashMax, min as lodashMin, sortBy, uniq, values } from 'lodash-es';
import ChartComponent from './chart-component';
import LegendMixin from '../mixins/legend';
import FloatingTooltipMixin from '../mixins/floating-tooltip';
import AxesMixin from '../mixins/axes';
import FormattableMixin from '../mixins/formattable';
import SortableChartMixin from '../mixins/sortable-chart';
import NoMarginChartMixin from '../mixins/no-margin-chart';
import AxisTitlesMixin from '../mixins/axis-titles';

import { groupBy } from '../utils/group-by';
import LabelTrimmer from '../utils/label-trimmer';
import { createSpan, createBr } from '../utils';

const VerticalBarChartComponent = ChartComponent.extend(LegendMixin,
  FloatingTooltipMixin, AxesMixin, FormattableMixin, SortableChartMixin,
  NoMarginChartMixin, AxisTitlesMixin, {

  classNames: ['chart-vertical-bar'],

  // ----------------------------------------------------------------------------
  // Vertical Bar Chart Options
  // ----------------------------------------------------------------------------

  // Data without group will be merged into a group with this name
  ungroupedSeriesName: 'Other',

  // If stackBars is yes then it stacks bars, otherwise it groups them
  // horizontally. Stacking discards negative data.
  // TODO(nick): make stacked bars deal gracefully with negative data
  stackBars: false,

  // Space between bars, as fraction of bar size
  withinGroupPadding: 0,

  // Space between bar groups, as fraction of group size
  betweenGroupPadding: Ember.computed('numBars', function() {
    // Use padding to make sure bars have a maximum thickness.
    //
    // TODO(tony): Use exact padding + bar width calculation
    // We have some set amount of bewtween group padding we use depending
    // on the number of bars there are in the chart. Really, what we would want
    // to do is have the equation for bar width based on padding and use that
    // to set the padding exactly.
    var scale = d3.scale.linear().domain([1, 8]).range([1.25, 0.25]).clamp(true);
    return scale(this.get('numBars'));
  }),

  numBars: Ember.computed('xBetweenGroupDomain', 'xWithinGroupDomain', function() {
    return this.get('xBetweenGroupDomain.length') * this.get('xWithinGroupDomain.length') || 0;
  }),

  // Space allocated for rotated labels on the bottom of the chart. If labels
  // are rotated, they will be extended beyond labelHeight up to maxLabelHeight
  maxLabelHeight: 50,

  willDestroyElement: function() {
    if(this._hasMouseEventListeners) {
      let viewportBars = this.getViewportBars();
      viewportBars.on('mouseover', null);
      viewportBars.on('mouseout', null);

      let bars = viewportBars.selectAll('rect');
      bars.on('mouseover', null);
      bars.on('mouseout', null);
    }

    this._super(...arguments);
  },

  // ----------------------------------------------------------------------------
  // Data
  // ----------------------------------------------------------------------------

  sortedData: Ember.computed('data.[]', 'sortKey', 'sortAscending', 'stackBars', function() {
    var data, group, groupData, groupObj, groupedData, key, newData, sortAscending, sortedGroups, summedGroupValues, _i, _len;
    if (this.get('stackBars')) {
      data = this.get('data');
      groupedData = lodashGroupBy(data, function(d) {
        return d.group;
      });
      summedGroupValues = Ember.A();

      const reduceByValue = (previousValue, dataObject) =>
        previousValue + dataObject.value;

      for (group in groupedData) {
        groupData = groupedData[group];
        if (group !== null) {
          summedGroupValues.pushObject({
            group: group,
            value: groupData.reduce(reduceByValue, 0)
          });
        }
      }
      key = this.get('sortKey');
      sortAscending = this.get('sortAscending');
      if (Ember.isEmpty(summedGroupValues)) {
        return Ember.A();
      } else if (key != null) {
        sortedGroups = summedGroupValues.sortBy(key);
        if (!sortAscending) {
          sortedGroups = sortedGroups.reverse();
        }
        newData = Ember.A();
        for (_i = 0, _len = sortedGroups.length; _i < _len; _i++) {
          groupObj = sortedGroups[_i];
          newData.pushObjects(groupedData[groupObj.group]);
        }
        return newData;
      } else {
        return data;
      }
    } else {
      return this._super();
    }
  }),

  // Aggregates objects provided in `data` in a dictionary, keyed by group names
  groupedData: Ember.computed('sortedData', 'stackBars', 'ungroupedSeriesName', function() {
    var data = this.get('sortedData');
    if (Ember.isEmpty(data)) {
      // TODO(embooglement): this can't be `Ember.A()` because it needs to be an
      // actual empty array for tests to pass, and `Ember.NativeArray` adds
      // a bunch of stuff to the prototype that gets enumerated by `_.values`
      // in `individualBarLabels`
    	return [];
   	}
    data = groupBy(data, (d) => {
      return d.group || this.get('ungroupedSeriesName');
    });

    // After grouping, the data points may be out of order, and therefore not properly
    // matched with their value and color. Here, we resort to ensure proper order.
    // This could potentially be addressed with a refactor where sorting happens after
    // grouping across the board.
    // TODO(ember-charts-lodash): Use _.mapValues instead of the each loop.
    each(keys(data), function(groupName) {
      data[groupName] = sortBy(data[groupName], 'label');
    });

    return data;
  }),

  groupNames: Ember.computed('groupedData', function() {
    return keys(this.get('groupedData'));
  }),

  // We know the data is grouped because it has more than one label. If there
  // are no labels on the data then every data object will have
  // 'ungroupedSeriesName' as its group name and the number of group
  // labels will be 1. If we are passed ungrouped data we will display
  // each data object in its own group.
  isGrouped: Ember.computed('groupNames.length', function() {
    var result = (this.get('groupNames.length') > 1);
    return result;
  }),

  finishedData: Ember.computed('groupedData', 'isGrouped', 'stackBars', 'sortedData', function() {
    var y0, stackedValues;
    if (this.get('isGrouped')) {
      if (Ember.isEmpty(this.get('groupedData'))) {
        return Ember.A();
      }

      return map(this.get('groupedData'), function(values, groupName) {
        y0 = 0;
        stackedValues = map(values, function(d) {
          return {
            y0: y0,
            y1: y0 += Math.max(d.value, 0),
            value: d.value,
            group: d.group,
            label: d.label,
            color: d.color
          };
        });

        return {
          group: groupName,
          values: values,
          stackedValues: stackedValues,
          totalValue: y0
        };
      });

    } else if (this.get('stackBars')) {
      if (Ember.isEmpty(this.get('data'))) {
        return Ember.A();
      }
      // If we do not have grouped data and are drawing stacked bars, keep the
      // data in one group so it gets stacked
      y0 = 0;
      stackedValues = map(this.get('data'), function(d) {
        return {
          y0: y0,
          y1: y0 += Math.max(d.value, 0),
          value: d.value,
          group: d.group,
          label: d.label,
          color: d.color
        };
      });

      return Ember.A([{
        group: this.get('data.firstObject.group'),
        values: this.get('data'),
        stackedValues: stackedValues,
        totalValue: y0
      }]);

    } else {

      if (Ember.isEmpty(this.get('data'))) {
        return Ember.A();
      }
      // If we do NOT have grouped data and do not have stackBars turned on, split the
      // data up so it gets drawn in separate groups and labeled
      return map(this.get('sortedData'), function(d) {
        return {
          group: d.label,
          values: [d]
        };
      });
    }
  // TODO(tony): Need to have stacked bars as a dependency here and the
  // calculation be outside of this
  }),

  // ----------------------------------------------------------------------------
  // Layout
  // ----------------------------------------------------------------------------

  labelHeightOffset: Ember.computed('_shouldRotateLabels', 'maxLabelHeight', 'labelHeight',
    'labelPadding', function() {

    var labelSize = this.get('_shouldRotateLabels') ? this.get('maxLabelHeight') : this.get('labelHeight');
    return labelSize + this.get('labelPadding');
  }),

  // Chart Graphic Dimensions
  graphicLeft: Ember.computed.alias('labelWidthOffset'),

  graphicWidth: Ember.computed('width', 'labelWidthOffset', function() {
     return this.get('width') - this.get('labelWidthOffset');
  }),

  graphicHeight: Ember.computed('height', 'legendHeight', 'legendChartPadding', function() {
    return this.get('height') - this.get('legendHeight') - this.get('legendChartPadding');
  }),

  // ----------------------------------------------------------------------------
  // Ticks and Scales
  // ----------------------------------------------------------------------------

  // Vertical position/length of each bar and its value
  yDomain: Ember.computed('finishedData', 'stackBars', function() {
    var finishedData = this.get('finishedData');
    var minOfGroups = d3.min(finishedData, function(d) {
      return lodashMin(d.values.map(function(dd) {
        return dd.value;
      }));
    });

    var maxOfGroups = d3.max(finishedData, function(d) {
      return lodashMax(d.values.map(function(dd) {
        return dd.value;
      }));
    });

    var maxOfStacks = d3.max(finishedData, function(d) {
      return d.totalValue;
    });

    // minOfStacks is always zero since we do not compute negative stacks
    // TODO(nick): make stacked bars deal gracefully with negative data
    var minOfStacks = d3.min(finishedData, function() { return 0; });

    var min, max;
    if (this.get('stackBars')) {
      min = minOfStacks;
      max = maxOfStacks;
    } else {
      min = minOfGroups;
      max = maxOfGroups;
    }

    // force one end of the range to include zero
    if (min > 0) {
      return [0, max];
    }
    if (max < 0) {
      return [min, 0];
    }
    if (min === 0 && max === 0) {
      return [0, 1];
    } else {
      return [min, max];
    }
  }),

  yScale: Ember.computed('graphicTop', 'graphicHeight', 'yDomain', 'numYTicks', function() {
    return d3.scale.linear()
      .domain(this.get('yDomain'))
      .range([ this.get('graphicTop') + this.get('graphicHeight'), this.get('graphicTop') ])
      .nice(this.get('numYTicks'));
  }),

  groupedIndividualBarLabels: Ember.computed('groupedData.[]', function() {
    var groups = map(values(this.get('groupedData')), function(g) {
      return map(g, 'label');
    });
    return uniq(flatten(groups));
  }),

  ungroupedIndividualBarLabels: Ember.computed('sortedData.@each.label', function() {
    return map(this.get('sortedData'), 'label');
  }),

  // The labels of the bars in the chart.
  //
  // When the bars in the chart are grouped, this CP returns the de-duplicated
  // set of labels that can appear within a single group,
  // in the order that they should appear in the group.
  // Per this.groupedData, this order is lexicographical by the label name,
  // regardless of this.sortKey. That is to ensure that the bar for
  // a given label is always in the same position within every group.
  // (See: https://github.com/Addepar/ember-charts/pull/81 )
  //
  // When the chart is not grouped, the labels are in the order that they
  // appear in the sorted bar data points, and are not de-duplicated.
  // (This is okay because whether or not the chart is grouped,
  // the client has the responsibility to make sure there are no dupe
  // (bar label, group label) pairs in the bar data.)
  //
  individualBarLabels: Ember.computed(
    'isGrouped',
    'stackBars',
    'groupedIndividualBarLabels',
    'ungroupedIndividualBarLabels',
  function() {
    if (this.get('isGrouped') || this.get('stackBars')) {
      return this.get('groupedIndividualBarLabels');
    } else {
      return this.get('ungroupedIndividualBarLabels');
    }
  }),

  labelIDMapping: Ember.computed('individualBarLabels.[]', function() {
    return this.get('individualBarLabels').reduce(function(previousValue, label, index) {
      previousValue[label] = index;
      return previousValue;
    }, {});
  }),

  // The range of labels assigned to each group
  xBetweenGroupDomain: Ember.computed.alias('groupNames'),
  // xBetweenGroupDomain: [],

  // The range of labels assigned within each group
  xWithinGroupDomain: Ember.computed.alias('individualBarLabels'),

  // The space in pixels allocated to each group
  groupWidth: Ember.computed('xBetweenGroupScale', function() {
    return this.get('xBetweenGroupScale').rangeBand();
  }),

  // The space in pixels allocated to each bar
  barWidth: Ember.computed('xWithinGroupScale', function() {
    return this.get('xWithinGroupScale').rangeBand();
  }),

  // The scale used to position bars within each group
  // If we do not have grouped data, use the withinGroupPadding around group
  // data since we will have constructed groups for each bar.
  xWithinGroupScale: Ember.computed('isGrouped', 'stackBars', 'xWithinGroupDomain', 'groupWidth',
    'withinGroupPadding', 'betweenGroupPadding', function() {

    if (this.get('isGrouped') || this.get('stackBars')) {
      return d3.scale.ordinal()
        .domain(this.get('xWithinGroupDomain'))
        .rangeRoundBands( [0, this.get('groupWidth')], this.get('withinGroupPadding')/2, 0);

    } else {
      return d3.scale.ordinal()
        .domain(this.get('xWithinGroupDomain'))
        .rangeRoundBands([ 0, this.get('groupWidth') ],
          this.get('betweenGroupPadding')/2, this.get('betweenGroupPadding')/2);
    }
  }),

  // The scale used to position each group and label across the horizontal axis
  // If we do not have grouped data, do not add additional padding around groups
  // since this will only add whitespace to the left/right of the graph.
  xBetweenGroupScale: Ember.computed('isGrouped', 'stackBars', 'graphicWidth', 'labelWidth',
    'xBetweenGroupDomain', 'betweenGroupPadding', function() {

    // var labelWidth = this.get('labelWidth');
    var betweenGroupPadding;

    if (this.get('isGrouped') || this.get('stackBars')) {
      betweenGroupPadding = this.get('betweenGroupPadding');
    } else {
      betweenGroupPadding = 0;
    }

    return d3.scale.ordinal()
      .domain(this.get('xBetweenGroupDomain'))
      .rangeRoundBands([0, this.get('graphicWidth')], betweenGroupPadding / 2, betweenGroupPadding / 2);

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
  // Color Configuration
  //
  // We cannot pass the mixed-in method this.getSeriesColor() directly to d3
  // as the callback to use to color the bars.
  // This is because for bar groups that do not have a meaningful
  // non-zero value for an individual bar, the client is free to not pass
  // a data point for that pair of (group, label) at all.
  //
  // In that case, when we use d3 to render bar groups with omitted bars,
  // using this.getSeriesColor() would tell d3 to use a color palette
  // with _more_ colors than bars in the bar group (since the number of colors
  // in the palette is this.numColorSeries).
  // Hence some bars would likely get a color that doesn't match the color
  // used for bars with the same label in other bar groups.
  //
  // So instead, we provide our own callback this.fnGetBarColor()
  // that looks at the bar label first and tries to look up the color
  // based on that. If that fails, then fnGetBarColor() defers to getSeriesColor().
  //
  // Note that we still use getSeriesColors() to initialize the mapping
  // from bar label to bar color, so it would be confusing if we tried to
  // override the property altogether.
  //
  // See bug #172 : https://github.com/Addepar/ember-charts/issues/172
  // ----------------------------------------------------------------------------

  numColorSeries: Ember.computed.alias('individualBarLabels.length'),

  barColors: Ember.computed('individualBarLabels.[]', 'getSeriesColor', function() {
    var fnGetSeriesColor = this.get('getSeriesColor');
    var result = {};
    this.get('individualBarLabels').forEach(function(label, labelIndex) {
      result[label] = fnGetSeriesColor(label, labelIndex);
    });
    return result;
  }),

  fnGetBarColor: Ember.computed('barColors', function() {
    var barColors = this.get('barColors');
    return function(d) {
      if (!Ember.isNone(d.color)) {
        return d.color;
      } else if (!Ember.isNone(d.label)) {
        return barColors[d.label];
      } else {
        return barColors[d];
      }
    };
  }),

  // ----------------------------------------------------------------------------
  // Legend Configuration
  // ----------------------------------------------------------------------------

  hasLegend: Ember.computed('stackBars', 'isGrouped', 'legendItems.length', 'showLegend', function() {
    return this.get('stackBars') || this.get('isGrouped') && this.get('legendItems.length') > 1 && this.get('showLegend');
  }),

  legendItems: Ember.computed('individualBarLabels.[]', 'barColors', 'stackBars', 'labelIDMapping.[]', function() {
    var barColors = this.get('barColors');
    return this.get('individualBarLabels').map((label, i) => {
      var color = barColors[label];
      if (this.get('stackBars')) {
        i = this.get('labelIDMapping')[label];
      }
      return {
        label: label,
        fill: color,
        stroke: color,
        icon: () => 'square',
        selector: ".grouping-" + i
      };
    });
  }),

  // ----------------------------------------------------------------------------
  // Tooltip Configuration
  // ----------------------------------------------------------------------------

  showDetails: Ember.computed('isInteractive', function() {
    if (!this.get('isInteractive')) {
      return Ember.K;
    }

    return (data, i, element) => {
      // Specify whether we are on an individual bar or group
      var isGroup = Ember.isArray(data.values);

      // Do hover detail style stuff here
      element = isGroup ? element.parentNode.parentNode : element;
      d3.select(element).classed('hovered', true);

      // Show tooltip
      var tipLabel = createSpan(data?.group ?? null, ['tip-label']);
      var content =  createSpan(null, null, [tipLabel]);

      var formatLabel = this.get('formatLabelFunction');
      var addValueLine = function(d) {
        content.appendChild(createSpan(`${d.label}: `, ['name']));
        content.append(createSpan(formatLabel(d.value), ['value']));
        content.append(createBr());
      };

      if (isGroup) {
        // Display all bar details if hovering over axis group label
        data.values.forEach(addValueLine);
      } else {
        // Just hovering over single bar
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
      // if we exited the group label undo for the group
      if (Ember.isArray(data.values)) {
        element = element.parentNode.parentNode;
      }
      // Undo hover style stuff
      d3.select(element).classed('hovered', false);

      // Hide Tooltip
      return this.hideTooltip();
    };
  }),


  // ----------------------------------------------------------------------------
  // Styles
  // ----------------------------------------------------------------------------

  groupAttrs: Ember.computed('graphicLeft', 'graphicTop', 'xBetweenGroupScale', function() {
    var xBetweenGroupScale = this.get('xBetweenGroupScale');

    return {
      transform: (d) => {
        var dx = xBetweenGroupScale(d.group) ? this.get('graphicLeft') + xBetweenGroupScale(d.group) : this.get('graphicLeft');
        var dy = this.get('graphicTop');

        return "translate(" + dx + ", " + dy + ")";
      }
    };
  }),

  commonBarAttrs: Ember.computed('labelIDMapping.[]', function() {
    return {
      class: (d) => {
        var id = this.get('labelIDMapping')[d.label];
        return "grouping-" + id;
      }
    };
  }),

  stackedBarAttrs: Ember.computed('commonBarAttrs', 'yScale', 'groupWidth', function() {
    var zeroDisplacement = 1;
    var yScale = this.get('yScale');

    return assign({
      'stroke-width': 0,
      width: () => this.get('groupWidth'),
      x: null,
      y: function(barSection) {
        return yScale(barSection.y1) + zeroDisplacement;
      },
      height: function(barSection) {
        return yScale(barSection.y0) - yScale(barSection.y1);
      }
    }, this.get('commonBarAttrs'));
  }),

  groupedBarAttrs: Ember.computed('commonBarAttrs', 'yScale', 'barWidth', 'xWithinGroupScale', function() {
    var zeroDisplacement = 1;
    var yScale = this.get('yScale');

    return assign({
      'stroke-width': 0,
      width: () => this.get('barWidth'),
      x: (d) => this.get('xWithinGroupScale')(d.label),
      height: function(d) {
        return Math.max(0, Math.abs(yScale(d.value) - yScale(0)) - zeroDisplacement);
      },
      y: function(d) {
        if (d.value > 0) {
          return yScale(d.value);
        } else {
          return yScale(0) + zeroDisplacement;
        }
      }
    }, this.get('commonBarAttrs'));
  }),

  labelAttrs: Ember.computed('barWidth', 'isGrouped', 'stackBars', 'groupWidth',
    'xWithinGroupScale', 'graphicTop', 'graphicHeight', 'labelPadding', function() {
    return {
      'stroke-width': 0,
      transform: (d) => {
        var dx = this.get('barWidth')/2;
        if (this.get('isGrouped') || this.get('stackBars')) {
          dx += this.get('groupWidth')/2 - this.get('barWidth')/2;
        } else {
          dx += this.get('xWithinGroupScale')(d.group);
        }
        var dy = this.get('graphicTop') + this.get('graphicHeight') + this.get('labelPadding');
        return "translate(" + dx + ", " + dy + ")";
      }
    };
  }),

  // ----------------------------------------------------------------------------
  // Selections
  // ----------------------------------------------------------------------------

  getViewportBars() {
    return this.get('viewport').selectAll('.bars');
  },

  get groups() {
    return this.getViewportBars().data(this.get('finishedData'));
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
  // Label Layout
  // ----------------------------------------------------------------------------

  // Space available for labels that are horizontally displayed. This is either
  // the unpadded group width or bar width depending on whether data is grouped
  maxLabelWidth: Ember.computed('isGrouped', 'stackBars', 'groupWidth', 'barWidth', function() {
    if (this.get('isGrouped') || this.get('stackBars')) {
      return this.get('groupWidth');
    } else {
      return this.get('barWidth');
    }
  }),

  _shouldRotateLabels: false,

  setRotateLabels: function() {
    var labels, maxLabelWidth, rotateLabels;
    labels = this.get('groups').select('.groupLabel text');
    maxLabelWidth = this.get('maxLabelWidth');
    rotateLabels = false;
    if (this.get('rotatedLabelLength') > maxLabelWidth) {
      labels.each(function() {
        if (this.getBBox().width > maxLabelWidth) {
          return rotateLabels = true;
        }
      });
    }
    this.set('_shouldRotateLabels', rotateLabels);
  },

  // Calculate the number of degrees to rotate labels based on how widely labels
  // will be spaced, but never rotate the labels less than 20 degrees
  rotateLabelDegrees: Ember.computed('labelHeight', 'maxLabelWidth', function() {
    var radians = Math.atan(this.get('labelHeight') / this.get('maxLabelWidth'));
    var degrees = radians * 180 / Math.PI;
    return Math.max(degrees, 20);
  }),

  rotatedLabelLength: Ember.computed('maxLabelHeight', 'rotateLabelDegrees', function() {
    var rotateLabelRadians = Math.PI / 180 * this.get('rotateLabelDegrees');
    return Math.abs(this.get('maxLabelHeight') / Math.sin(rotateLabelRadians));
  }),

  // ----------------------------------------------------------------------------
  // Drawing Functions
  // ----------------------------------------------------------------------------

  renderVars: [
    'xWithinGroupScale',
    'xBetweenGroupScale',
    'yScale',
    'finishedData',
    'getSeriesColor',
    'xValueDisplayName',
    'yValueDisplayName',
    'hasAxisTitles', // backward compatibility support.
    'hasXAxisTitle',
    'hasYAxisTitle',
    'xTitleHorizontalOffset',
    'yTitleVerticalOffset'
  ],

  drawChart: function() {
    this.updateData();
    this.updateLayout();
    if (this.getHasScheduledDraw()) {
      /*
       * updateLayout may have caused another draw of this chart to be
       * scheduled. Specifically in ADPR-62603 when it changes label rotation
       * it does so via an Ember property change which eventually, via an
       * observer, causes a new drawing to be scheduled.
       *
       * Subsequent method calls in this function expect the DOM to reflect
       * updated values such as the aforementioned rotation. For example
       * updateAxes expects the rotation to have flushed to DOM or it may
       * update `graphicLeft` in a way that causes yet another draw to
       * be scheduled (causing an infinite loop).
       *
       * So here the drawing is eagerly aborted if, after updating layout,
       * anything has caused a re-render to be requested. That allows any
       * state to be flushed through Ember's property change system before
       * trying again with settled JS/DOM state.
       */
      return;
    }
    this.updateAxes();
    this.updateGraphic();
    this.updateAxisTitles();
    if (this.get('hasLegend')) {
      return this.drawLegend();
    } else {
      return this.clearLegend();
    }
  },

  updateData: function() {
    var groups = this.get('groups');
    var showDetails = this.get('showDetails');
    var hideDetails = this.get('hideDetails');
    this._hasMouseEventListeners = true;

    var entering = groups.enter()
      .append('g').attr('class', 'bars');
    entering.append('g').attr('class', 'groupLabel')
      .append('text')
      .on("mouseover", function(d, i) { return showDetails(d, i, this); })
      .on("mouseout", function(d, i) { return hideDetails(d, i, this); });
    groups.exit().remove();

    var subdata;
    if (this.get('stackBars')) {
      subdata = function(d) { return d.stackedValues; };
    } else {
      subdata = function(d) { return d.values; };
    }

    var bars = groups.selectAll('rect').data(subdata);
    bars.enter().append('rect')
      .on("mouseover", function(d, i) { return showDetails(d, i, this); })
      .on("mouseout", function(d, i) { return hideDetails(d, i, this); });
    return bars.exit().remove();
  },

  updateLayout: function() {
    var groups = this.get('groups');
    var labels = groups.select('.groupLabel text')
      .attr('transform', null) // remove any previous rotation attrs
      .text(function(d) { return d.group; });

    // If there is enough space horizontally, center labels underneath each
    // group. Otherwise, rotate each label and anchor it at the top of its
    // first character.
    this.setRotateLabels();
    var labelTrimmer;

    if (this.get('_shouldRotateLabels')) {
      var rotateLabelDegrees = this.get('rotateLabelDegrees');
      labelTrimmer = LabelTrimmer.create({
        getLabelSize: () => this.get('rotatedLabelLength'),
        getLabelText: (d) => d.group
      });

      return labels.call(labelTrimmer.get('trim')).attr({
        'text-anchor': 'end',
        transform: "rotate(" + (-rotateLabelDegrees) + ")",
        dy: function() { return this.getBBox().height; }
      });

    } else {
      var maxLabelWidth = this.get('maxLabelWidth');
      labelTrimmer = LabelTrimmer.create({
        getLabelSize: () => maxLabelWidth,
        getLabelText: (d) => d.group != null ? d.group : ''
      });

      return labels.call(labelTrimmer.get('trim')).attr({
        'text-anchor': 'middle',
        dy: this.get('labelPadding')
      });
    }
  },

  updateAxes: function() {
    //tickSize isn't doing anything here, it should take two arguments
    var yAxis = d3.svg.axis()
      .scale(this.get('yScale'))
      .orient('right')
      .ticks(this.get('numYTicks'))
      .tickSize(this.get('graphicWidth'))
      .tickFormat(this.get('formatValueAxis'));

    var gYAxis = this.get('yAxis');

    // find the correct size of graphicLeft in order to fit the Labels perfectly
    this.set('graphicLeft', this.maxLabelLength(gYAxis.selectAll('text')) + this.get('labelPadding') );


    var graphicTop = this.get('graphicTop');
    var graphicLeft = this.get('graphicLeft');
    gYAxis.attr({ transform: "translate(" + graphicLeft + ", " + graphicTop + ")" })
      .call(yAxis);

    gYAxis.selectAll('g')
      .filter(function(d) { return d !== 0; })
      .classed('major', false)
      .classed('minor', true);

    gYAxis.selectAll('text')
      .style('text-anchor', 'end')
      .attr({
        x: -this.get('labelPadding')
      });
  },

  updateGraphic: function() {
    var groups = this.get('groups');

    var barAttrs = this.get('stackBars') ? this.get('stackedBarAttrs') : this.get('groupedBarAttrs');

    groups.attr(this.get('groupAttrs') );
    groups.selectAll('rect')
      .attr(barAttrs)
      .style('fill', this.get('fnGetBarColor'));
    return groups.select('g.groupLabel')
      .attr(this.get('labelAttrs') );
  }
});

export default VerticalBarChartComponent;
