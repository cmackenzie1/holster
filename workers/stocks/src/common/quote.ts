export interface Quote {
	// Date of the quote in yyyy-mm-dd format
	date: string;
	// The trading symbol
	symbol: string;
	// Price at opening
	open: number | null;
	// Highest price of the day
	high: number | null;
	// Lowest price of the day
	low: number | null;
	// Current trading price
	price: number;
	// Previous day closing price
	previousClose: number;
	// Closing price
	close: number | null;
	// Currency symbol to be used when formatting prices.
	currencySymbol: string;
	// currencyCode: ISO 4217 https://en.wikipedia.org/wiki/ISO_4217
	currencyCode: string;
}
