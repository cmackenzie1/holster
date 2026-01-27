import { Hono } from "hono";
import { YahooFinance } from "./yahoofinance";

export interface StockQuote {
	date: string;
	symbol: string;
	currencyCode: string;
	currencySymbol: string;
	price: number;
	open: number;
	high: number;
	low: number;
	close: number;
	previousClose: number;
}

const SYMBOL_REGEX = /^[A-Za-z0-9.^=_-]{1,20}$/;

const app = new Hono();

app.get("/:symbol", async (c) => {
	const symbol = c.req.param("symbol");

	if (!symbol || !SYMBOL_REGEX.test(symbol)) {
		return c.json({ error: "Invalid stock symbol." }, 400);
	}

	const yahoo = new YahooFinance();
	const quote = await yahoo.quote(symbol);

	if (!quote) {
		return c.json({ error: "Failed to fetch quote for symbol." }, 404);
	}

	return c.json(quote);
});

app.all("*", (c) => c.json({ error: "Not found." }, 404));

export default app;
