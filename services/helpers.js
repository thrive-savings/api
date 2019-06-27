module.exports = () => ({
  getDollarString: (amount, fractionDigitsCount = 2, dollarPrefix = true) => {
    let dollars = amount / 100
    dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(fractionDigitsCount)
    dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    return dollarPrefix ? `$${dollars}` : dollars
  }
})
