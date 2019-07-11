module.exports = () => ({
  getDollarString: (amount, fractionDigitsCount = 2, dollarPrefix = true) => {
    let dollars = amount / 100
    dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(fractionDigitsCount)
    dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    return dollarPrefix ? `$${dollars}` : dollars
  },

  getSynapseHeaders: (authKey = '') => ({
    'X-SP-GATEWAY': `${process.env.synapseClientID}|${
      process.env.synapseClientSecret
    }`,
    'X-SP-USER-IP': '127.0.0.1',
    'X-SP-USER': `${authKey}|${process.env.synapseUserID}`
  })
})
