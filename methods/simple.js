const config = require('../config.json');
const simple_config = config.methods.simple;
const Alpaca = require('@alpacahq/alpaca-trade-api');

const alpaca = new Alpaca(config.alpaca);

alpaca.getClock().then(function(clock) {
  if (clock.is_open || true) {
    simple_config.stocks.forEach(function(stock) {
      alpaca.getAsset(stock).then(function(asset) {
        if (asset.tradable) {
          alpaca.getBars('day', stock, {
            limit: 5
          }).then(function(bars) {
            var min = false;
            var max = false;
            var current = 0;
            bars = bars[stock];

            bars.forEach(function(bar) {
              if (!min || min > bar.l) {
                min = bar.l;
              }

              if (!max || max < bar.h) {
                max = bar.h;
              }

              current = bar.c
            });


          });
        }
      });
    });
  }
});
