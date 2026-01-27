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

const app = new Hono();

app.get("/:symbol", async (c) => {
	const symbol = c.req.param("symbol");
	const yahoo = new YahooFinance();
	return c.json(await yahoo.quote(symbol));
});

export default app;
