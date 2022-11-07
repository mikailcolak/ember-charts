// TODO(azirbel): This needs to be an external dependency.
import Ember from 'ember';
import { isFunction } from 'lodash-es';

export default Ember.Mixin.create({
  resizeEndDelay: 200,
  resizing: false,
  onResizeStart() {},
  onResizeEnd() {},
  onResize() {},

  get endResize() {
    return function(event) {
      if (this.isDestroyed) {
        return;
      }
      this.set('resizing', false);
      if (isFunction(this.onResizeEnd)) {
        this.onResizeEnd(event);
      }
    };
  },

  handleWindowResize: function(event) {
    if ((typeof event.target.id !== "undefined" && event.target.id !== null) &&
        (event.target.id !== this.elementId)) {
      return;
    }
    if (!this.get('resizing')) {
      this.set('resizing', true);
      if (isFunction(this.onResizeStart)) {
        this.onResizeStart(event);
      }
    }
    if (isFunction(this.onResize)) {
      this.onResize(event);
    }
    return Ember.run.debounce(this, this.get('endResize'), event, this.get('resizeEndDelay'));
  },

  didInsertElement: function() {
    this._super();
    return this._setupDocumentHandlers();
  },

  willDestroyElement: function() {
    this._removeDocumentHandlers();
    return this._super();
  },


  _setupDocumentHandlers: function () {
    if (this._resizeHandler) {
      return;
    }
    this._resizeHandler = this.get('handleWindowResize').bind(this);
    window.addEventListener('resize', this._resizeHandler);
  },

  _removeDocumentHandlers: function () {
    window.removeEventListener('resize', this._resizeHandler);
    return this._resizeHandler = null;
  }
});
