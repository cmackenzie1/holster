import type { Quote } from "../common/quote";

interface QuoteResult {
	meta: {
		currency: string;
		symbol: string;
		exchangeName: string;
		regularMarketPrice: number;
		previousClose: number;
		regularMarketTime: number;
		exchangeTimezoneName: string;
	};
	indicators: {
		quote: {
			high: (number | null)[];
			close: (number | null)[];
			open: (number | null)[];
			low: (number | null)[];
		}[];
	};
}

interface QuoteError {
	code: string;
	description: string;
}

interface QuoteResponse {
	chart:
		| {
				result: QuoteResult[];
				error: null;
		  }
		| {
				result: null;
				error: QuoteError;
		  };
}

const CHROME_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class YahooFinance {
	private readonly url = "https://query1.finance.yahoo.com";

	async quote(symbol: string): Promise<Quote | null> {
		const url = new URL(
			`/v8/finance/chart/${encodeURIComponent(symbol)}`,
			this.url,
		);

		console.log({
			event: "yahoo_finance_request",
			symbol,
			url: url.toString(),
		});

		const resp = await fetch(url.toString(), {
			headers: {
				"User-Agent": CHROME_USER_AGENT,
			},
		});

		if (!resp.ok) {
			console.log({
				event: "yahoo_finance_error",
				symbol,
				status: resp.status,
				statusText: resp.statusText,
			});
			return null;
		}

		const data: QuoteResponse = await resp.json();
		if (data.chart.error) {
			console.log({
				event: "yahoo_finance_chart_error",
				symbol,
				error_code: data.chart.error.code,
				error_description: data.chart.error.description,
			});
			return null;
		}

		const result = data.chart.result.pop();
		if (!result) {
			console.log({ event: "yahoo_finance_no_result", symbol });
			return null;
		}

		const quote = result.indicators.quote.pop();
		if (!quote) {
			console.log({ event: "yahoo_finance_no_quote", symbol });
			return null;
		}

		const highs = quote.high.filter((v): v is number => v !== null);
		const lows = quote.low.filter((v): v is number => v !== null);
		const opens = quote.open.filter((v): v is number => v !== null);
		const closes = quote.close.filter((v): v is number => v !== null);

		console.log({
			event: "yahoo_finance_success",
			symbol: result.meta.symbol,
			price: result.meta.regularMarketPrice,
			currency: result.meta.currency,
		});

		return {
			date: new Date(result.meta.regularMarketTime * 1000).toLocaleDateString(
				"en-CA",
				{
					timeZone: result.meta.exchangeTimezoneName,
				},
			),
			symbol: result.meta.symbol,
			currencyCode: result.meta.currency,
			currencySymbol: "$",
			price: result.meta.regularMarketPrice,
			open: opens[0] ?? null,
			high: highs.length > 0 ? Math.max(...highs) : null,
			low: lows.length > 0 ? Math.min(...lows) : null,
			close: closes[closes.length - 1] ?? null,
			previousClose: result.meta.previousClose,
		} as Quote;
	}
}
