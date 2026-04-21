# `dns`

DNS lookup tool at [`dns.mirio.dev`](https://dns.mirio.dev), powered by
[Cloudflare DNS-over-HTTPS](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/).

## Usage

```sh
# Default A-record lookup
curl https://dns.mirio.dev/example.com

# Specific record type
curl https://dns.mirio.dev/example.com?type=MX
curl https://dns.mirio.dev/example.com?type=TXT
curl https://dns.mirio.dev/example.com?type=AAAA

# Full DoH JSON response
curl https://dns.mirio.dev/example.com?type=NS&format=json
```

## Supported record types

`A`, `AAAA`, `CAA`, `CNAME`, `MX`, `NS`, `PTR`, `SOA`, `SRV`, `TXT`

## Content negotiation

| Accept / format | Response |
| --- | --- |
| `text/html` | Interactive lookup tool (browser) or per-query result page |
| `application/json` or `?format=json` | Raw [DoH JSON](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/) payload |
| *(default)* | Zone-style plain text: `name\tTTL\tIN\tTYPE\tdata` |
