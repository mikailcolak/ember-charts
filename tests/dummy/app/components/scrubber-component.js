import Ember from 'ember';

export default Ember.Component.extend({

  tagName: 'input',
  attributeBindings: ['min', 'max', 'step', 'type', 'value'],
  type: 'range',
  min: 0,
  max: 10,
  step: 1,
  change: function() {
    this.set('value', +this.element.value);
  }

});
