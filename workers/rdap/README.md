# RDAP

Query RDAP (Registration Data Access Protocol) servers for domain registration information using `curl`.

## API

- **GET /:domain** - Query RDAP server for domain registration information.

The response is a `key=value` list of domain registration information. Any lists are comma-separated. See example below for more information.

## Usage

```bash
curl -s https://rdap.mirio.dev/google.com

domain=google.com
registered_at=1997-09-15T04:00:00Z
expires_at=1997-09-15T04:00:00Z
last_changed=2019-09-09T15:39:04Z
last_updated=2024-04-12T02:50:28Z
name_servers=NS1.GOOGLE.COM,NS2.GOOGLE.COM,NS3.GOOGLE.COM,NS4.GOOGLE.COM
status=client delete prohibited,client transfer prohibited,client update prohibited,server delete prohibited,server transfer prohibited,server update prohibited
```

