var ko = require('knockout');

var viewModelsToAttach = {};

function attachViewModels(document) {
  if (document && (
        document.readyState === 'complete' ||
        document.readyState === 'loaded' ||
        document.readyState === 'interactive')) {

    // Find attach attributes and attach view models
    var attachPoints = document.querySelectorAll('*[data-attach]');
    for(var i = 0; i < attachPoints.length; i++) {
      var el = attachPoints[i];
      var name = el.getAttribute('data-attach');
      var vmOptions = viewModelsToAttach[name];
      if (vmOptions) {
        var vm = vmOptions.viewModel;
        var callback = vmOptions.callback;

        // Bind the view model to the template, call the callback
        ko.applyBindings(vm, el);
        if (callback) callback(vm, el);
      }
    }

    // Reset view models to attach
    viewModelsToAttach = {};
  }
}

if (global.document) {
  global.document.addEventListener('DOMContentLoaded', function() {
    attachViewModels(global.document);
  });
}

exports.extend = function(extendOptions) {
  extendOptions = extendOptions || {};

  function tko(initOptions) {
    initOptions = initOptions || {};

    // Set debug on instance from init options
    this.debug = initOptions['debug'];

    // Copy the template name onto the instance from init options if it exists
    this.template = initOptions.template || extendOptions.template;

    // Create observables and observable arrays from extend options
    var observables = extendOptions['observables'] ? extendOptions['observables']() : {};
    Object.keys(observables).forEach(function(key) {
      var defaultValue = observables[key];
      if (Array.isArray(defaultValue)) {
        this[key] = ko.observableArray(observables[key]);
      } else {
        this[key] = ko.observable(observables[key]);
      }
    }, this);

    // Default values from data in extend options
    var data = extendOptions['data'] ? extendOptions['data']() : {};
    Object.keys(data).forEach(function(key) {
      if (ko.isObservable(this[key])) {
        this[key](data[key]);
      } else {
        this[key] = data[key];
      }
    }, this);

    // Initial values from data in init options
    var data = initOptions['data'] || {};
    Object.keys(data).forEach(function(key) {
      if (ko.isObservable(this[key])) {
        this[key](data[key]);
      } else {
        this[key] = data[key];
      }
    }, this);

    // Create computed observables (defer evaluation so they can be in any order)
    var computed = extendOptions['computed'] || {};
    Object.keys(computed).forEach(function(key) {
      var definition = computed[key];
      if (isFunction(definition)) {
        this[key] = ko.computed(definition, this, { deferEvaluation: true });
      } else {
        this[key] = ko.computed({
          read: definition.read,
          write: definition.write,
          owner: this,
          deferEvaluation: true,
        });
      }
    }, this);

    // Create subscriptions from extend options
    var subscriptions = extendOptions['subscriptions'] || {};
    Object.keys(subscriptions).forEach(function(key) {
      var method = subscriptions[key];
      if (isFunction(method)) {
        this[key].subscribe(method, this);
      } else {
        // Wrapped in anon func so subscriptions can be stubbed/spied on
        this[key].subscribe(function(val) { this[method](val) }, this);
      }
    }, this);

    // Create subscriptions from init options
    var subscriptions = initOptions['subscriptions'] || {};
    Object.keys(subscriptions).forEach(function(key) {
      var method = subscriptions[key];
      if (isFunction(method)) {
        this[key].subscribe(method, this);
      } else {
        // Wrapped in anon func so subscriptions can be stubbed/spied on
        this[key].subscribe(function(val) { this[method](val) }, this);
      }
    }, this);

    // Call init method provided in extend options
    var init = extendOptions['init'];
    if (init) init.call(this);

    // Call init method provided in init options
    var init = initOptions['init'];
    if (init) init.call(this);
  };

  // Copy methods onto the constructor's prototype from extend options
  var methods = extendOptions['methods'] || {};
  Object.keys(methods).forEach(function(key) {
    tko.prototype[key] = methods[key];
  });

  // Copy helper methods onto the constructor's prototype from extend options
  var helpers = extendOptions['helpers'] || {};
  tko.prototype.helpers = {};
  Object.keys(helpers).forEach(function(key) {
    tko.prototype.helpers[key] = helpers[key];
  });

  // $get helper method
  tko.prototype.$get = function(keypath) {
    return keypath.split('.').reduce(function(base, segment) {
      if (base === undefined) return base;
      var value = base[segment];
      if (ko.isObservable(value)) {
        return value();
      } else {
        return value;
      }
    }, this);
  };

  // $attach helper method
  tko.prototype.$attach = function(name, callback) {
    viewModelsToAttach[name] = {
      viewModel: this,
      callback: callback,
    };
    attachViewModels(global.document);
    return this;
  };

  return tko;
};


// Helpers

function isFunction(val) {
  return Object.prototype.toString.call(val) === '[object Function]';
}
