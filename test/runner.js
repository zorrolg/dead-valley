(function () {

  var deferred = $.when($.getScript("test/lib/jasmine-1.2.0/jasmine.js"));

  var scripts = ["lib/jasmine-1.2.0/jasmine-html.js",
                 "lib/jasmine-1.2.0/jasmine-jquery.js",
                 "menu_test.js"];

  _.each(scripts, function (script) {
    deferred = deferred.pipe(function () {
      return $.getScript("test/" + script);
    });
  });

  deferred.then(function () {

    // turn jquery effects off
    $.fx.off = true;

    $('head').append('<link rel="stylesheet" type="text/css" href="test/lib/jasmine-1.2.0/jasmine.css">');

    var jasmineEnv = jasmine.getEnv();
    jasmineEnv.updateInterval = 1000;

    var htmlReporter = new jasmine.HtmlReporter();

    jasmineEnv.addReporter(htmlReporter);

    jasmineEnv.specFilter = function (spec) {
      return htmlReporter.specFilter(spec);
    };

    jasmineEnv.execute();

  }).fail(function () {
    console.log('FAIL!', arguments);
  });

})();
