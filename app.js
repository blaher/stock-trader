const config = require('./config.json');

var express = require('express');
var app = express();

const Alpaca = require('@alpacahq/alpaca-trade-api');
const alpaca = new Alpaca(config.alpaca);

console.log('Canceling all orders...');
alpaca.getOrders({
  status: 'open'
}).then(function(orders) {
  var promises = [];
  orders.forEach(function(order) {
    console.log('Canceling order...');
    promises.push(alpaca.cancelOrder(order.id));
  });

  Promise.all(promises).then(function() {
    console.log('Selling all positions...');
    alpaca.getPositions().then(function(positions) {
      positions.forEach(function(position) {
        console.log('Selling position...');
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
        console.log({
          symbol: data.order.symbol,
          qty: data.order.qty,
          side: 'sell',
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: parseFloat(data.order.limit_price) + config.trading.stock_difference_increment
        });
        alpaca.createOrder({
          symbol: data.order.symbol,
          qty: data.order.qty,
          side: 'sell',
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: parseFloat(data.order.limit_price) + config.trading.stock_difference_increment
        });
      }
    });

    client.connect();
  });
});

var cron = require('./cron');

app.use('/cron', cron);

app.listen(8081, function() {
  console.log('Set up!');
});
