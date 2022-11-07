import Ember from 'ember';

export default Ember.Mixin.create({

  // # ----------------------------------------------------------------------------
  // # API -- inputs
  // #
  // # elementId: the id of the object we're attaching the tooltip to
  // # ----------------------------------------------------------------------------
  elementId: null,
  tooltipWidth: 40,
  tooltipValueDisplayName: 'Value',

  showTooltip: function(content, event) {
    var $ttid = this._getTooltip();
    $ttid.innerHTML = content;
    $ttid.classList.remove('hidden');
    return this._updateTooltipPosition(event);
  },

  hideTooltip: function() {
    return this._getTooltip().classList.add('hidden');
  },

  // # ----------------------------------------------------------------------------
  // # Private Methods
  // # ----------------------------------------------------------------------------
  get _tooltipId() {
    return this.get('elementId') + '_tooltip';
  },

  _getTooltip: function() {
    return document.querySelector("#" + this.get('_tooltipId'));
  },

  _updateTooltipPosition: function(event) {
    var $tooltip = this._getTooltip();
    // # Offset the tooltip away from the mouse position
    var xOffset = 10;
    var yOffset = 10;

    // # Get tooltip width/height
    var width = $tooltip.clientWidth;
    var height = $tooltip.clientHeight;

    // # Get top/left coordinates of scrolled window
    var windowScrollTop = 0;
    var windowScrollLeft = 0;

    // # Get current X,Y position of cursor even if window is scrolled
    var curX = event.clientX + windowScrollLeft;
    var curY = event.clientY + windowScrollTop;

    var tooltipLeftOffset;
    if ((curX - windowScrollLeft + xOffset * 2 + width) > window.innerWidth) {
      // # Not enough room to put tooltip to the right of the cursor
      tooltipLeftOffset = -(width + xOffset * 2);
    } else {
      // # Offset the tooltip to the right
      tooltipLeftOffset = xOffset;
    }

    var tooltipLeft = curX + tooltipLeftOffset;

    var tooltipTopOffset;
    if ((curY - windowScrollTop + yOffset * 2 + height) > window.innerHeight) {
      // # Not enough room to put tooltip to the below the cursor
      tooltipTopOffset = -(height + yOffset * 2);
    } else {
      // # Offset the tooltip below the cursor
      tooltipTopOffset = yOffset;
    }

    var tooltipTop = curY + tooltipTopOffset;

    // # Tooltip must be a minimum offset away from the left/top position
    var minTooltipLeft = windowScrollLeft + xOffset;
    var minTooltipTop = windowScrollTop + yOffset;
    if (tooltipLeft < minTooltipLeft) {
      tooltipLeft = minTooltipLeft;
    }
    if (tooltipTop < windowScrollTop + yOffset) {
      tooltipTop = minTooltipTop;
    }

    // # Place tooltip
    $tooltip.style.top = `${tooltipTop}px`;
    $tooltip.style.left = `${tooltipLeft}px`;
    return $tooltip;
  },

  // # ----------------------------------------------------------------------------
  // # Internal
  // # ----------------------------------------------------------------------------

  didInsertElement: function() {
    this._super();
    const tooltip = document.createElement('div');
    tooltip.setAttribute('id', this.get('_tooltipId'));
    tooltip.classList.add('chart-float-tooltip');
    this.element.appendChild(tooltip);
    return this.hideTooltip();
  },

  willDestroyElement: function() {
    this._super();
    return this.element.removeChild(this._getTooltip());
  }
});
