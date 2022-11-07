// usage:
// assertTooltip(assert, {
//      isVisible: true,
//      label: '2013-05-15',
//      name: 'Financial analytics software: ',
//      value: '49,668.00'
// });
import { waitFor } from '@ember/test-helpers';

export default async function assertTooltip(assert, { isVisible, label, name, value }) {
  await waitFor(`.chart-float-tooltip${(isVisible === true ? ':not(.hidden)' : '.hidden')}`, { timeout: 500 });

  if (isVisible !== undefined) {
    assert.dom('.chart-float-tooltip').exists();
  }

  if (label !== undefined) {
    assert.dom('.chart-float-tooltip .tip-label').exists().containsText(label);
  }

  if (name !== undefined) {
    assert.dom('.chart-float-tooltip .name').exists().containsText(name);
  }

  if (value !== undefined) {
    assert.dom('.chart-float-tooltip .value').exists().containsText(value);
  }
};
