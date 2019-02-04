var express = require('express');
var app = express();

var methods_simple = require('./methods/simple');

app.use('/methods/simple', methods_simple);

app.listen(6666, function() {
  console.log('Set up!');
});
