console.log('Setting up...');

const config = require('../config.json');
const simple_config = config.methods.simple;
const stocks = simple_config.stocks;
const Alpaca = require('@alpacahq/alpaca-trade-api');

const alpaca = new Alpaca(config.alpaca);

function after_position(account, stock, asset, position) {
  console.log('Getting bar data for stock '+stock+'...');
  alpaca.getBars('day', stock, {
    limit: 5
  }).then(function(bars) {
    console.log('Figuring account value per stock for '+stock+'...');
    const value_per_stock = account.portfolio_value / stocks.length;
    console.log('value_per_stock: ', value_per_stock);

    var min = false;
    var max = false;
    var current = 0;
    bars = bars[stock];

    console.log('Figuring out max, min, and current price for '+stock+'...');
    bars.forEach(function(bar) {
      if (!min || min > bar.l) {
        min = bar.l;
      }

      if (!max || max < bar.h) {
        max = bar.h;
      }

      current = bar.c
    });
    console.log('max: ', max);
    console.log('min: ', min);
    console.log('current: ', current);

    console.log('Figuring current position and cash for '+stock+'...');
    const position_value_for_stock = position.market_value;
    const cash_for_stock = value_per_stock - position_value_for_stock;
    console.log('position_value_for_stock: ', position_value_for_stock);
    console.log('cash_for_stock: ', cash_for_stock);

    console.log('Figuring buy orders for '+stock+'...');
    var buy_orders = [];
    var current_price = (Math.round(current*100)-Math.round(simple_config.stock_difference_increment*100))/100;
    var cash_left = cash_for_stock;
    const min_usd_per_transaction = simple_config.min_usd_per_transaction;
    var buy_increment = min_usd_per_transaction;
    var buy_difference = simple_config.stock_difference_increment;
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
  });
}

console.log('Getting account information...');
alpaca.getAccount().then(function(account) {
  console.log('Making sure account is good...');
  if (!account.account_blocked && !account.trading_blocked && account.portfolio_value > 25000) {
    console.log('Getting clock information...');
    alpaca.getClock().then(function(clock) {
      console.log('Making sure markets are open...');
      if (clock.is_open || true) {
        console.log('Looping through stocks...');
        stocks.forEach(function(stock) {
          console.log('Getting stock information for '+stock+'...');
          alpaca.getAsset(stock).then(function(asset) {
            console.log('Checking if '+stock+' is tradable...');
            if (asset.tradable) {
              console.log('Getting position for '+stock+'...');
              alpaca.getPosition(stock).then(function(position) {
                after_position(account, stock, asset, position);
              }, function() {
                var position = {
                  market_value: 0
                };

                after_position(account, stock, asset, position);
              });
            }
          });
        });
      }
    });
  }
});
