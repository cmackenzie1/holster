import { Quote } from '../common/quote';

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
    quote: { high: (number | null)[]; close: (number | null)[]; open: (number | null)[]; low: (number | null)[] }[];
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

export class YahooFinance {
  private readonly url = 'https://query1.finance.yahoo.com';

  async quote(symbol: string, date?: string): Promise<Quote | null> {
    const url = new URL(`/v8/finance/chart/${symbol}`, this.url);
    console.log(url.toString());
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      return null;
    }
    const data: QuoteResponse = await resp.json();
    if (data.chart.error) {
      return null;
    }
    const result = data.chart.result.pop()!;
    const quote = result.indicators.quote.pop()!;

    return {
      // use `en-CA` for `yyyy-mm-dd` format
      date: new Date(result.meta.regularMarketTime * 1000).toLocaleDateString('en-CA', {
        timeZone: result.meta.exchangeTimezoneName,
      }),
      symbol: result.meta.symbol,
      currencyCode: result.meta.currency,
      currencySymbol: '$',
      price: result.meta.regularMarketPrice,
      open: quote.open.filter(Boolean)[0] || null,
      high: Math.max(...(quote.high.filter(Boolean) as number[])),
      low: Math.min(...(quote.low.filter(Boolean) as number[])),
      close: quote.close.filter(Boolean).pop(),
      previousClose: result.meta.previousClose,
    } as Quote;
  }
}
