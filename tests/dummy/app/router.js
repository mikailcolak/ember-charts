import EmberRouter from '@ember/routing/router';
import config from 'dummy/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {

  this.route('license');

  this.route('overview');
  this.route('documentation');
  this.route('pie');
  this.route('horizontal-bar');
  this.route('vertical-bar');
  this.route('stacked-vertical-bar');
  this.route('time-series');
  this.route('scatter');
  // this.route('bubble');

});
