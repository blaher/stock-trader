const config = require('./config.json');

var express = require('express');
var app = express();

const Alpaca = require('@alpacahq/alpaca-trade-api');
const alpaca = new Alpaca(config.alpaca);

console.log('Canceling all orders...');
alpaca.getOrders({
  status: 'open'
}).then(function(orders) {
  orders.forEach(function(order) {
    alpaca.cancelOrder(order.id);
  });
});

var methods_simple = require('./methods/simple');

app.use('/methods/simple', methods_simple);

app.listen(8081, function() {
  console.log('Set up!');
});
