console.log('Setting up...');

const config = require('./config.json');
const trading_config = config.trading;
const stocks = trading_config.stocks;
const Alpaca = require('@alpacahq/alpaca-trade-api');

var express = require('express');
var router = express.Router();

const alpaca = new Alpaca(config.alpaca);

router.post('/', function(req, res) {
  function execute_orders(buy_orders, sell_orders) {
    console.log('Generating buy orders...');
    buy_orders.forEach(function(buy_order) {
      alpaca.createOrder({
        symbol: buy_order.stock,
        qty: buy_order.quantity,
        side: 'buy',
        type: 'limit',
        time_in_force: 'day',
        limit_price: buy_order.price
      });
    });

    console.log('Generating sell orders...');
    sell_orders.forEach(function(sell_order) {
      alpaca.createOrder({
        symbol: sell_order.stock,
        qty: sell_order.quantity,
        side: 'sell',
        type: 'limit',
        time_in_force: 'day',
        limit_price: sell_order.price
      });
    });

    console.log('Completed!');
    res.send('Completed!');
  }

  function after_position(account, stock, asset, orders, position) {
    console.log('Getting bar data for stock '+stock+'...');
    alpaca.getBars('day', stock, {
      limit: 5
    }).then(function(bars) {
      alpaca.getBars('minute', stock, {
        limit: 1
      }).then(function(latest_bars) {
        console.log('Figuring account value per stock for '+stock+'...');
        const value_per_stock = account.portfolio_value / stocks.length;
        console.log('value_per_stock: ', value_per_stock);

        var min = false;
        var max = false;
        var current = 0;
        bars = bars[stock];
        latest_bars = latest_bars[stock];

        console.log('Figuring out max, min, and current price for '+stock+'...');
        bars.forEach(function(bar) {
          if (!min || min > bar.l) {
            min = bar.l;
          }

          if (!max || max < bar.h) {
            max = bar.h;
          }
        });
        current = Math.round(latest_bars[0].c*100)/100;
        console.log('max: ', max);
        console.log('min: ', min);
        console.log('current: ', current);

        console.log('Figuring current position and cash for '+stock+'...');
        const position_value_for_stock = position.market_value;
        const stocks_owned = position.qty;
        const cash_for_stock = value_per_stock - position_value_for_stock;
        console.log('position_value_for_stock: ', position_value_for_stock);
        console.log('stocks_owned: ', stocks_owned);
        console.log('cash_for_stock: ', cash_for_stock);

        console.log('Figuring buy orders for '+stock+'...');
        var buy_orders = [];
        var current_price = (Math.round(current*100)-Math.round(trading_config.stock_difference_increment*100))/100;
        var cash_left = cash_for_stock;

        if (cash_left > account.buying_power) {
          cash_left = account.buying_power;
        }

        const min_usd_per_transaction = trading_config.min_usd_per_transaction;
        var buy_increment = min_usd_per_transaction;
        var buy_difference = trading_config.stock_difference_increment;
        var buy_audit_amount = 0;

        var count = 0;
        for (var i = current_price; i >= min;) {
          i = (Math.round(i*100)-Math.round(buy_difference*100))/100
          count++;
        }

        if (cash_for_stock / buy_increment > count) {
          buy_increment = cash_for_stock / count;
        }

        while (current_price >= min && cash_left >= min_usd_per_transaction) {
          var quantity = Math.round(buy_increment*100)/Math.round(current_price*100);
          quantity = Math.ceil(quantity);

          if (buy_increment > cash_left) {
            quantity = Math.round(cash_left*100)/Math.round(current_price*100);
            quantity = Math.floor(quantity);
          }

          buy_orders.push({
            stock: stock,
            price: current_price,
            quantity: quantity
          });
          buy_audit_amount += Math.round(current_price*100)*quantity;

          cash_left = (Math.round(cash_left*100)-Math.round((current_price*100)*quantity))/100;
          current_price = (Math.round(current_price*100)-Math.round(buy_difference*100))/100;
        }
        console.log('buy_orders: ', buy_orders);
        console.log('buy_audit_amount: ', buy_audit_amount/100);

        console.log('Figuring sell orders for '+stock+'...');
        var sell_orders = [];
        current_price = (Math.round(current*100)+Math.round(trading_config.stock_difference_increment*100))/100;

        var sell_increment = Math.ceil(min_usd_per_transaction/current);
        var sell_difference = trading_config.stock_difference_increment;
        var sell_audit_amount = 0;
        var stocks_left = stocks_owned;

        orders.forEach(function(order) {
          if (order.side === 'sell' && order.symbol === stock) {
            stocks_left -= order.qty;
          }
        });

        count = 0;
        for (var i = current_price; i <= max;) {
          i = (Math.round(i*100)+Math.round(sell_difference*100))/100
          count++;
        }

        if (cash_for_stock/buy_increment > count && stocks_owned/count > sell_increment) {
          sell_increment = Math.ceil(stocks_owned/count);
        }

        while (current_price <= max && stocks_left >= sell_increment && stocks_left > 0) {
          var quantity = sell_increment;

          sell_orders.push({
            stock: stock,
            price: current_price,
            quantity: quantity
          });
          sell_audit_amount += quantity;

          current_price = (Math.round(current_price*100)+Math.round(buy_difference*100))/100;
          stocks_left -= quantity;
        }
        console.log('sell_orders: ', sell_orders);
        console.log('sell_audit_amount: ', sell_audit_amount);

        execute_orders(buy_orders, sell_orders);
      });
    });
  }

  console.log('Getting account information...');
  alpaca.getAccount().then(function(account) {
    console.log('Making sure account is good...');
    if (!account.account_blocked && !account.trading_blocked && account.portfolio_value > 25000) {
      console.log('Getting clock information...');
      alpaca.getClock().then(function(clock) {
        console.log('Making sure markets are open...');
        if (clock.is_open) {
          console.log('Looping through stocks...');
          stocks.forEach(function(stock) {
            console.log('Getting stock information for '+stock+'...');
            alpaca.getAsset(stock).then(function(asset) {
              console.log('Checking if '+stock+' is tradable...');
              if (asset.tradable) {
                console.log('Getting orders...');
                alpaca.getOrders({
                  status: 'open'
                }).then(function(orders) {
                  console.log('Getting position for '+stock+'...');
                  alpaca.getPosition(stock).then(function(position) {
                    after_position(account, stock, asset, orders, position);
                  }, function() {
                    var position = {
                      market_value: 0,
                      qty: 0
                    };

                    after_position(account, stock, asset, orders, position);
                  });
                });
              }
            });
          });
        } else {
          console.log('Currently afterhours!');
          res.send('Currently afterhours!');
        }
      });
    } else {
      console.log('Account not able to trade!');
      res.send('Account not able to trade!');
    }
  });
});

module.exports = router;
