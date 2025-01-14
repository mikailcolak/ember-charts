// import Ember from "ember";
// import { cloneDeep, countBy, filter, forOwn, keys } from 'lodash-es';
// import { module, test } from 'qunit';
// import { setupTest } from 'ember-qunit';

// // tinycolor only defines itself as an AMD module if it thinks an AMD dll loader
// // is present (typeof define === 'function' && define.amd);
// // unfortunately loader.js doesn't set define.amd and thus is incompatible.
// // So we must use the global tinycolor instead.
// var tinycolor = window.tinycolor;

// var threeRanges = [{
//    label: "Label 1",
//    group: "Group One",
//    value: 20
// }, {
//    label: "Label 1",
//    group: "Group Two",
//    value: 32
// }, {
//    label: "Label 1",
//    group: "Group Three",
//    value: 4
// }, {
//    label: "Label 2",
//    group: "Group One",
//    value: 16
// }, {
//    label: "Label 2",
//    group: "Group Two",
//    value: 17
// }, {
//    label: "Label 2",
//    group: "Group Three",
//    value: -18
// }, {
//    label: "Label 3",
//    group: "Group One",
//    value: -18
// }, {
//    label: "Label 3",
//    group: "Group Two",
//    value: 18
// }, {
//    label: "Label 3",
//    group: "Group Three",
//    value: -19
// }];


// module('Unit | Component | vertical-bar-chart', function (hooks) {
//   setupTest(hooks);

//   var label1, label2, label3, labelClassMappingTestData;

//   label1 = "Label 1";

//   label2 = "Label 2";

//   label3 = "Label 3";

//   labelClassMappingTestData = [
//     {
//       label: label1,
//       group: "Group 1",
//       value: 20
//     }, {
//       label: label2,
//       group: "Group 2",
//       value: 32
//     }, {
//       label: label3,
//       group: "Group 3",
//       value: 4
//     }, {
//       label: label3,
//       group: "Group 3",
//       value: 16
//     }, {
//       label: label2,
//       group: "Group 2",
//       value: 17
//     }
//   ];

//   test('Margins are the right size', function(assert) {
//     var component = this.subject();
//     assert.expect(3);

//     assert.equal(component.get('marginLeft'), 0, 'no left margin');
//     assert.equal(component.get('marginRight'), 0, 'no right margin');
//     assert.equal(component.get('marginBottom'), 0, 'no bottom margin');
//   });

//   test('Sorting bars by value works when the chart is not grouped', function(assert) {
//     const chartConfig = {
//       data: [{
//         label: "Label 1",
//         value: 20
//       }, {
//         label: "Label 2",
//         value: -1
//       }],
//       sortKey: 'value',
//       sortAscending: true
//     };
//     var component, bar1, bar2, bar1x, bar2x;

//     assert.expect(3);
//     component = this.subject(chartConfig);
//     this.render();

//     bar1 = component.$('g.bars:contains(Label 1) rect');
//     bar2 = component.$('g.bars:contains(Label 2) rect');
//     assert.equal(bar1.length, 1, 'There is a bar for Label 1');
//     assert.equal(bar2.length, 1, 'There is a bar for Label 2');

//     // Check that the bar for Label 1 is on the _right_.
//     bar1x = parseInt(bar1.attr('x'));
//     bar2x = parseInt(bar2.attr('x'));
//     assert.ok(bar1x > bar2x, 'The bar for Label 1 is to the right of the one for Label 2');
//   });

//   test('Stacked bar chart data is sorted correctly', function(assert) {
//     var component = this.subject();
//     assert.expect(8);
//     Ember.run(function() {
//       var data, sortedData, original = [], sorted = [], groups = [],
//         totals = [], originalGroups = [];

//       component.set('data', threeRanges);
//       component.set('stackBars', true);

//       data = component.get('data');
//       sortedData = component.get('sortedData');

//       original.push(data.slice(0,3));
//       original.push(data.slice(3,6));
//       original.push(data.slice(6,9));

//       originalGroups.push(original[0].every((item) => item.group === 'Group Three'));
//       originalGroups.push(original[1].every((item) => item.group === 'Group One'));
//       originalGroups.push(original[2].every((item) => item.group === 'Group Two'));

//       sorted.push(sortedData.slice(0,3));
//       sorted.push(sortedData.slice(3,6));
//       sorted.push(sortedData.slice(6,9));

//       totals.push(sorted[0].map((val) => val.value).reduce((left,right) => left+right));
//       totals.push(sorted[1].map((val) => val.value).reduce((left,right) => left+right));
//       totals.push(sorted[2].map((val) => val.value).reduce((left,right) => left+right));

//       groups.push(sorted[0].every((item) => item.group === 'Group Three'));
//       groups.push(sorted[1].every((item) => item.group === 'Group One'));
//       groups.push(sorted[2].every((item) => item.group === 'Group Two'));

//       assert.ok(!originalGroups[0], 'Group three is not first');
//       assert.ok(!originalGroups[1], 'Group one is not second');
//       assert.ok(!originalGroups[2], 'Group two is not third');

//       assert.ok(groups[0], 'Group three is first');
//       assert.ok(groups[1], 'Group one is second');
//       assert.ok(groups[2], 'Group two is third');

//       assert.ok(totals[0] < totals[1], 'Group three is the smaller than group one');
//       assert.ok(totals[1] < totals[2], 'Group one is the smaller than group two');
//     });
//   });

//   const checkBarLabelMappingToClass = function(testContext, assert, stackBars) {
//     testContext.subject({stackBars: stackBars, data: labelClassMappingTestData});
//     testContext.render();
//     var labelIDMapping = testContext.subject().get('labelIDMapping');

//     assert.equal(testContext.$().find(".grouping-" + labelIDMapping[label1]).length, 1, 'label1 has one section');
//     assert.equal(testContext.$().find(".grouping-" + labelIDMapping[label2]).length, 2, 'label2 has two sections');
//     assert.equal(testContext.$().find(".grouping-" + labelIDMapping[label3]).length, 2, 'label3 has two sections');
//   };

//   // https://github.com/Addepar/ember-charts/issues/172
//   //
//   // The root cause of problem 2 was that when some data groups have fewer data than others,
//   // the bars for the smaller groups got assigned the wrong style classes.
//   // The classes determine which bars get highlighted when you mouse over the bar label
//   // in the legend.
//   //
//   test('Bug 172 Problem 2: Bars get style classes corresponding to their bar label, ' +
//       'regardless of what bar group they belong to',
//   function(assert) {
//     checkBarLabelMappingToClass(this, assert, false);
//   });

//   test('Slices in stacked bars get style classes corresponding to their slice label',
//   function(assert) {
//     checkBarLabelMappingToClass(this, assert, true);
//   });

//   // https://github.com/Addepar/ember-charts/issues/172
//   test('Bug 172 Problem 1: When some data groups have fewer data then others, ' +
//       'the smaller groups still give their bars the correct colors',
//   function(assert) {
//     var testData, dataPointCountsByBarLabel, component, legendColorsByBarLabel;

//     testData = filter(threeRanges, function(datum) {
//       return (datum.group !== "Group Two" || datum.label !== "Label 1");
//     });
//     dataPointCountsByBarLabel = countBy(testData, 'label');
//     assert.expect(1 + keys(dataPointCountsByBarLabel).length);

//     component = this.subject({data : testData});
//     this.render();

//     // Get the colors assigned to each bar label in the chart legend
//     legendColorsByBarLabel = {};
//     component.$('svg g.legend-item').each(function() {
//       var label = $(this).text();
//       legendColorsByBarLabel[label] = tinycolor($('path', this).attr('fill')).toRgbString();
//     });

//     assert.deepEqual(
//       keys(legendColorsByBarLabel).sort(),
//       keys(dataPointCountsByBarLabel).sort(),
//       "The set of bar labels shown in the legend is the same as the one from the test data");

//     // For each bar label in the chart legend, check that the actual number of
//     // bars with that label's color equals the expected number of data points
//     // with that label per the data set
//     forOwn(legendColorsByBarLabel, function(colorString, label) {
//       var actualBarsWithColor = component.$('svg rect').filter(function() {
//         return (colorString === tinycolor($(this).css('fill')).toRgbString());
//       });
//       assert.equal(
//         actualBarsWithColor.length,
//         dataPointCountsByBarLabel[label],
//         dataPointCountsByBarLabel[label] + " bars were found with color " + colorString +
//           ", which is the color in the legend for bar label " + label);
//     });
//   });

//   test('Pull Request #182: A bar-specific color override is respected', function(assert) {
//     const chartBaseColor = 'rgb(65, 65, 65)';
//     const barOverrideColor = tinycolor('red').toRgbString();
//     var testData, component, actualBarColors;

//     assert.expect(1);
//     testData = cloneDeep(threeRanges);
//     testData[0].color = barOverrideColor;

//     component = this.subject({
//       data: testData,
//       selectedSeedColor: chartBaseColor,
//     });
//     this.render();

//     actualBarColors = component.$('svg rect').map(function() {
//       return tinycolor($(this).css('fill')).toRgbString();
//     });
//     assert.notEqual(
//       actualBarColors.toArray().indexOf(barOverrideColor),
//       -1,
//       "There is a bar in the chart with the correct override color " + barOverrideColor
//     );
//   });

//   test('ADPR-62603: An infinite loop based on label orientation will not occur', function(assert) {
//     let testData = [
//       {"label":"Preservation","value":0.0365451846828686},
//       {"label":"Growth","value":-0.05189082702329095},
//       {"label":"Inflation","value":0.4651320110022441}
//     ];

//     let container = document.querySelector('#ember-testing');
//     let oldStyle = container.getAttribute('style');
//     try {
//       container.style.width='482.39px';
//       container.style.height='176px';
//       container.style.transform='scale(1.0)';

//       let component = this.subject({
//         data: testData,
//         labelAngle: -1,
//         labelWidthMultiplier: 0.25,
//         portfolioVisualizationLabelHeight: 50,
//         showChartControls: true,
//         isInteractive: false,
//         isEditable: false,
//         maxBarThickness: null,
//         minBarThickness: null,
//         defaultOuterHeight: 176,
//         defaultOuterWidth: 482,
//         labelWidthOffset: 55.39,
//         axisTitleHeight: 10,
//         barWidth: 63,
//         sortKey: null,
//         maxAxisValue: 0.8,
//         minAxisValue: -0.2,
//         formatValueAxis: value => `%${Math.round(value*100)}`
//       });
//       this.render();

//       assert.ok(true, 'test completed');
//     } finally {
//       container.setAttribute('style', oldStyle);
//     }
//   });
// });
