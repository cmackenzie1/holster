import { type IRequest, Router } from "itty-router";
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

const router = Router();

router.get("/:symbol", async (request: IRequest) => {
	const { params } = request;
	const yahoo = new YahooFinance();
	return Response.json(await yahoo.quote(params.symbol));
});

export default router;
