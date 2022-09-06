export interface Quote {
  // Date of the quote in yyyy-mm-dd format
  date: string;
  // The trading symbol
  symbol: string;
  // Price at opening
  open: number;
  // Highest price of the day
  high: number;
  // Lowest price of the day
  low: number;
  // Current trading price
  price: number;
  // Previous day closing price
  previousClose: number;
  // Currency symbol to be used when formatting prices.
  currencySymbol: '$';
  // currencyCode: ISO 4217 https://en.wikipedia.org/wiki/ISO_4217
  currencyCode: 'USD';
}
