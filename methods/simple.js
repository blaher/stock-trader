const config = require('../config.json');
const Alpaca = require('@alpacahq/alpaca-trade-api');

const alpaca = new Alpaca(config.alpaca);

alpaca.getAccount().then(function(account) {
  console.log('Current Account:', account)
});
