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

console.log('Selling all positions...');
alpaca.getPositions().then(function(positions) {
  positions.forEach(function(position) {
    alpaca.createOrder({
      symbol: position.symbol,
      qty: position.qty,
      side: 'sell',
      type: 'market',
      time_in_force: 'day'
    });
  });
});

console.log('Setting up websocket...');
const client = alpaca.websocket;

client.onConnect(function() {
  console.log('Connected to websocket!');
  client.subscribe(['trade_updates']);
});

client.onDisconnect(function() {
  console.log('Disconnected from websocket!')
});

client.onOrderUpdate(function(data) {
  console.log('Order updated...');
  if (data.event === 'fill' && data.order && data.order.side === 'buy') {
    alpaca.createOrder({
      symbol: order.symbol,
      qty: order.qty,
      side: 'sell',
      type: 'limit',
      time_in_force: 'gtc',
      limit_price: order.limit_price + config.trading.stock_difference_increment
    });
  }
})

var methods_simple = require('./methods/simple');

app.use('/methods/simple', methods_simple);

app.listen(8081, function() {
  console.log('Set up!');
});
