import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import domTriggerEvent from '../helpers/async/dom-trigger-event';
import { emberSelectFor } from '../helpers/utils/selector-for';
import assertTooltip from '../helpers/sync/assert-tooltip';
import { fillIn, visit } from '@ember/test-helpers';

var countBars = function () {
  return document.querySelectorAll('.chart-vertical-bar svg g.bars').length;
};

var countRects = function () {
  return document.querySelectorAll('.chart-vertical-bar svg rect').length;
};

module('Acceptance | vertical-bar', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(async () => {
    await visit('/vertical-bar');
  });

  test('tooltip mouseover with bars: two_ranges', async function (assert) {

    await fillIn(emberSelectFor('data'), 'two_ranges');
    await domTriggerEvent('.grouping-0', 'mouseover');

    assertTooltip(assert, {
      isVisible: true,
      label: 'S&P Goldman Sachs Commodity Total Return Index',
      name: 'Cash & Cash Equivalent:',
      value: '1,933,418.12'
    });
  });

  test('tooltip mouseout with bars: two_ranges', async function (assert) {

    await fillIn(emberSelectFor('data'), 'two_ranges');
    await domTriggerEvent('.grouping-0', 'mouseover');
    await domTriggerEvent('.grouping-0', 'mouseout');

    assertTooltip(assert, { isVisible: false });
  });

  test('select bars: two_ranges', async function (assert) {
    assert.expect(2);

    await fillIn(emberSelectFor('data'), 'two_ranges');

    assert.equal(2, countBars());
    assert.equal(14, countRects());
  });

  test('select bars: three_ranges', async function (assert) {
    assert.expect(2);

    await fillIn(emberSelectFor('data'), 'three_ranges');

    assert.equal(3, countBars());
    assert.equal(9, countRects());
  });

  test('select bars: five_ranges', async function (assert) {
    assert.expect(2);

    await fillIn(emberSelectFor('data'), 'five_ranges');

    assert.equal(5, countBars());
    assert.equal(25, countRects());
  });

  test('select bars: sector_compare_return', async function (assert) {
    assert.expect(2);

    await fillIn(emberSelectFor('data'), 'sector_compare_return');

    assert.equal(5, countBars());
    assert.equal(50, countRects());
  });

  test('select bars: null data', async function (assert) {
    assert.expect(2);

    await fillIn(emberSelectFor('data'), '----');

    assert.equal(0, countBars());
    assert.equal(0, countRects());
  });

  test('select bars: empty data', async function (assert) {
    assert.expect(2);

    await fillIn(emberSelectFor('data'), 'empty');

    assert.equal(0, countBars());
    assert.equal(0, countRects());
  });

  test('select bars: asset_values', async function (assert) {
    assert.expect(2);

    await fillIn(emberSelectFor('data'), 'asset_values');

    assert.equal(6, countBars());
    assert.equal(6, countRects());
  });
});
