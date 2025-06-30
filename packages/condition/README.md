# @cmackenzie1/condition

A generic data notifier that allows clients to wait for some condition to become ready. This package is particularly useful for implementing long polling patterns where clients need to wait for data or events to occur.

## Installation

```bash
pnpm i jsr:@cmackenzie1/condition
```

## Usage

### Basic Example

```typescript
import { Condition } from '@cmackenzie1/condition';

// Create a condition for user data
interface UserData {
  id: string;
  name: string;
  email: string;
}

const userDataNotifier = new Condition<UserData>();

// Client waits for data (with 5 second timeout)
const result = await userDataNotifier.wait(5000);

if (result.status === 'ready') {
  console.log('User data received:', result.data);
} else {
  console.log('Timeout: No data received within 5 seconds');
}

// From another part of your application, notify waiting clients
userDataNotifier.notifyAll({
  id: '123',
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Long Polling Example

```typescript
import { Condition } from '@cmackenzie1/condition';

// Server-side implementation
class MessageQueue {
  private messageCondition = new Condition<string>();

  async waitForMessage(timeoutMs = 30000) {
    return this.messageCondition.wait(timeoutMs);
  }

  publishMessage(message: string) {
    this.messageCondition.notifyAll(message);
  }
}

// Usage in an HTTP handler
const messageQueue = new MessageQueue();

// Endpoint for long polling
app.get('/poll', async (req, res) => {
  const result = await messageQueue.waitForMessage(30000);

  if (result.status === 'ready') {
    res.json({ message: result.data });
  } else {
    res.status(204).send(); // No content
  }
});

// Endpoint to publish messages
app.post('/message', (req, res) => {
  messageQueue.publishMessage(req.body.message);
  res.send('Message published');
});
```

### Signaling Without Data

```typescript
import { Condition } from '@cmackenzie1/condition';

// Create a simple signal notifier
const readySignal = new Condition<void>();

// Wait for a ready signal
const result = await readySignal.wait(10000);
if (result.status === 'ready') {
  console.log('System is ready!');
}

// Signal that system is ready (no data needed)
readySignal.notifyAll();
```

### Multiple Waiters

```typescript
import { Condition } from '@cmackenzie1/condition';

const dataNotifier = new Condition<number[]>();

// Multiple clients can wait simultaneously
const client1 = dataNotifier.wait(5000);
const client2 = dataNotifier.wait(5000);
const client3 = dataNotifier.wait(5000);

// All waiting clients will be notified at once
dataNotifier.notifyAll([1, 2, 3, 4, 5]);

// All clients receive the same data
const results = await Promise.all([client1, client2, client3]);
results.forEach((result, index) => {
  if (result.status === 'ready') {
    console.log(`Client ${index + 1} received:`, result.data);
  }
});
```

## API Reference

### `Condition<T>`

Creates a new condition notifier with optional type parameter `T` for the data type.

#### Methods

##### `wait(timeoutMs?: number): Promise<Result>`

Waits for data to become available with an optional timeout.

- **Parameters:**
  - `timeoutMs` (optional): Maximum time to wait in milliseconds. Default: 30000 (30 seconds)

- **Returns:** A promise that resolves to:
  - `{ status: 'timeout' }` - If the timeout is reached before data is available
  - `{ status: 'ready', data?: T }` - When data becomes available

##### `notifyAll(data?: T): void`

Notifies all waiting clients that data is available.

- **Parameters:**
  - `data` (optional): The data to pass to waiting clients

## License

MIT
