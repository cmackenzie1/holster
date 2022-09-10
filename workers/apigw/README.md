# `apigw` 🌉

API Gateway (`apigw`) is a worker designed to "shim" between different forms of HTTP Authentication.

For example, some applications only support using HTTP Basic Auth (ie, terraform http backend) but the `tfstate` worker
is
protected by Cloudflare Access.
So, in order to support terraform tooling, the API GW will inject the appropriate `CF-Access-Client-Id`
and `CF-Access-Client-Secret`headers, based on the incoming `Authorization` header. The altered request will then be
sent upstream.
