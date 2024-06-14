export class HTTPAnalytics {
	binding?: AnalyticsEngineDataset;

	constructor(binding?: AnalyticsEngineDataset) {
		this.binding = binding;
	}

	public observe(request: Request): void {
		if (!this.binding) {
			return;
		}

		const url = new URL(request.url);
		const { method, cf } = request;
		const ip = request.headers.get("cf-connecting-ip");

		this.binding.writeDataPoint({
			indexes: [url.hostname],
			blobs: [
				method, // HTTP method
				request.url, // URL
				ip, // IP address, can be IPv4 or IPv6
				(cf?.httpProtocol as string) || "unknown", // HTTP protocol
				(cf?.colo as string) || "unknown", // Cloudflare data center
				(cf?.latitude as string) || "unknown", // Latitude
				(cf?.longitude as string) || "unknown", // Longitude
			],
		});
	}
}
