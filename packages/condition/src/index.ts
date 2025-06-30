/**
 * A generic data notifier that allows clients to wait for some condition to become ready.
 * Supports long polling with timeout and abort signal functionality.
 *
 * @template T - The type of data that will be made available to waiting clients
 *
 * @example
 * ```typescript
 * interface UserData { id: string; name: string; }
 * const notifier = new Condition<UserData>();
 *
 * // Client waits for data
 * const result = await notifier.wait(30000);
 * if (result.status === 'ready') {
 *   console.log('User data:', result.data);
 * }
 *
 * // Notify clients when data is available
 * notifier.notifyAll({ id: '123', name: 'John' });
 * ```
 */
export class Condition<T = unknown> {
	/**
	 * Set of client resolver functions waiting for data to become available
	 */
	private waitingClients = new Set<(data?: T) => void>();

	/**
	 * Waits for data to become available with an optional timeout.
	 * This method will resolve when either data becomes available or the timeout is reached.
	 *
	 * @param timeoutMs - Maximum time to wait for data in milliseconds (default: 30000)
	 * @returns Promise that resolves to either a timeout status or ready status with optional data
	 *
	 * @example
	 * ```typescript
	 * const result = await notifier.wait(5000);
	 * if (result.status === 'timeout') {
	 *   console.log('No data received within 5 seconds');
	 * } else {
	 *   console.log('Data received:', result.data);
	 * }
	 * ```
	 */
	async wait(
		timeoutMs = 30000,
	): Promise<{ status: "timeout" } | { status: "ready"; data?: T }> {
		return new Promise((resolve) => {
			// Set up timeout
			const timeoutId = setTimeout(() => {
				this.waitingClients.delete(clientResolver);
				resolve({ status: "timeout" });
			}, timeoutMs);

			// Add client to waiting list
			const clientResolver = (data?: T) => {
				clearTimeout(timeoutId);
				this.waitingClients.delete(clientResolver);
				resolve({ status: "ready", data });
			};

			this.waitingClients.add(clientResolver);
		});
	}

	/**
	 * Notifies all waiting clients that data is available.
	 * This will resolve all pending wait promises with the provided data.
	 *
	 * @param data - Optional data to pass to waiting clients
	 *
	 * @example
	 * ```typescript
	 * // Notify with data
	 * notifier.notifyAll({ id: '123', name: 'John' });
	 *
	 * // Notify without data (just signal availability)
	 * notifier.notifyAll();
	 * ```
	 */
	notifyAll(data?: T): void {
		// Resolve all waiting clients
		const clients = this.waitingClients;
		this.waitingClients = new Set(); // Reset the waiters
		for (const resolve of clients) {
			resolve(data);
		}
	}
}
