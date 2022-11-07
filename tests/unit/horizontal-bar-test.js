// import Ember from "ember";
// import { every } from 'lodash-es';
// import { module, test } from 'qunit';
// import { setupRenderingTest, setupTest } from 'ember-qunit';

// import all_negatives from '../../models/single_group/all_negatives';
// import { render } from "@ember/test-helpers";

// module('Unit | Component | horizontal-bar-chart', function (hooks) {
//   setupRenderingTest(hooks);

//   test("correct behavior with null maxBarThickness and minBarThickness", function (assert) {
//     assert.expect(2);

//     const component = this.owner.lookup('component:horizontal-bar-chart');
//     component.set('maxBarThickness', null);
//     component.set('minBarThickness', null);

//     assert.equal(component.get('maxOuterHeight'), null, 'maxOuterHeight is null when maxBarThickness is null');
//     assert.equal(component.get('minOuterHeight'), null, 'minOuterHeight is null when minBarThickness is null');
//   });

//   test("X & Y titles coordinates are correct", function (assert) {
//     assert.expect(12);

//     const component = this.owner.lookup('component:horizontal-bar-chart');

//     component.set('graphicWidth', 100);
//     component.set('xTitleHorizontalOffset', 30);
//     component.set('graphicBottom', 50);
//     component.set('xTitleVerticalOffset', 10);
//     component.set('labelWidthOffset', 40);
//     component.set('graphicHeight', 70);
//     component.set('yTitleVerticalOffset', 1);

//     assert.equal(component.get('xAxisPositionX'),  80, 'x position of X axis Title is correct');
//     assert.equal(component.get('xAxisPositionY'),  60, 'y position of X axis Title is correct');
//     assert.equal(component.get('yAxisPositionX'), -34, 'x position of Y axis Title is correct');
//     assert.equal(component.get('yAxisPositionY'), -40, 'y position of Y axis Title is correct');

//     //Test when user increases graphWidth
//     component.set('graphicWidth', 200);

//     assert.equal(component.get('xAxisPositionX'), 130, 'when graphicWidth is changed, x position of X axis Title is correct');
//     assert.equal(component.get('xAxisPositionY'),  60, 'when graphicWidth is changed, x position of X axis Title is correct');
//     assert.equal(component.get('yAxisPositionX'), -34, 'when graphicWidth is changed, x position of Y axis Title is correct');
//     assert.equal(component.get('yAxisPositionY'), -40, 'when graphicWidth is changed, y position of Y axis Title is correct');

//     //Test when user increases graphicHeight + graphicBottom
//     component.set('graphicHeight', 200);
//     component.set('graphicBottom', 180);

//     assert.equal(component.get('xAxisPositionX'), 130, 'when graphicWidth is changed, x position of X axis Title is correct');
//     assert.equal(component.get('xAxisPositionY'), 190, 'when graphicWidth is changed, x position of X axis Title is correct');
//     assert.equal(component.get('yAxisPositionX'), -99, 'when graphicWidth is changed, x position of Y axis Title is correct');
//     assert.equal(component.get('yAxisPositionY'), -40, 'when graphicWidth is changed, y position of Y axis Title is correct');
//   });

//   test("Margin bottom depends on the label padding and title offset",
//     function (assert) {
//       assert.expect(2);

//       const component = this.owner.lookup('component:horizontal-bar-chart');

//       component.set('labelPadding', 100,);
//       component.set('xTitleVerticalOffset', 30);

//       assert.equal(component.get('marginBottom'), 100, 'Margin bottom is independent of the xTitleVerticalOffset when there is no xAxis title');

//       component.set('hasXAxisTitle', true);
//       assert.equal(component.get('marginBottom'), 130, 'Margin bottom is depedent on the xTitleVerticalOffset when there is x  Axis title');
//     });

//   test("Value/Grouping Labels appear on the left/right when all data is 0 or negative", async function (assert) {
//       assert.expect(1);

//       const component = this.owner.lookup('component:horizontal-bar-chart');
//       component.set('data', all_negatives);

//       await this.render(component);
//       debugger;
//       const barGroups = component.element.querySelectorAll('g.bar');
//       const allLabelsCorrectlyPositioned = barGroups.every(group => {
//         const groupLabel = group.querySelector('text.group');
//         const valueLabel = group.querySelector('text.value');
//         return valueLabel.offset().left < groupLabel.offset().left;
//       });

//       assert.ok(allLabelsCorrectlyPositioned, 'The value labels are all to the left of the group labels');
//     });

//   test("Labels aren't trimmed when width is small", function (assert) {
//     const testData = [{
//       label: "some really long label that is really long",
//       value: 10000,
//       type: "money"
//     }, {
//       label: "another label",
//       value: -100,
//       type: "money"
//     }];

//     const component = this.subject({
//       data: testData,
//     });

//     // Charts set their defaultOuterWidth when they're rendered, so it has to be
//     // set after rendering
//     Ember.run(() => { component.set('defaultOuterWidth', 300); });

//     const groupLabels = component.$('text.group');
//     const noLabelsTruncated = every(groupLabels, function (label) {
//       return label.textContent.indexOf('...') === -1;
//     });
//     assert.ok(noLabelsTruncated,
//       `For charts with a mix of positive and negative values, labels are not
//         truncated when width is small`);
//   });
// });
