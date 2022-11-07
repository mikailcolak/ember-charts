import { waitFor } from  '@ember/test-helpers';

// unfortunatly triggerEvent(selector, eventName); doesn't fire d3 handler */
// see http://stackoverflow.com/a/30803644/4950029

export default async function(selector, eventName) {
  var element = document.querySelector(selector);
  var event = document.createEvent('SVGEvents');
  event.initEvent(eventName, true, true);
  element.dispatchEvent(event);
  await new Promise(resolve => setTimeout(resolve, 10));
}
