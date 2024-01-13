# Paste

Share small snippets of text using the web! All Pastes expire after 7 days.

Pastes is built using [Cloudflare Workers](https://workers.cloudflare.com/) and Cloudflare D1.

## Usage

### Create a new Paste

```bash
curl -v https://paste.mirio.dev/pastes -H 'Content-Type: text/plain' -d 'Hello World!'

{"url":"https://paste.mirio.dev/pastes/shwMg0"}
```

### Get a Paste

```bash
curl https://paste.mirio.dev/pastes/shwMg0

Hello World!
```
