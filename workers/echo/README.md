# `echo` 📣

Echo back the request received

```
curl https://echo.mirio.dev | jq

{
  "headers": {
    "accept": "*/*",
    "accept-encoding": "gzip",
    "cf-connecting-ip": "63.229.18.140",
    "cf-ipcountry": "US",
    "cf-ray": "7401e028faf53089",
    "cf-visitor": "{\"scheme\":\"https\"}",
    "connection": "Keep-Alive",
    "host": "echo.mirio.dev",
    "user-agent": "curl/7.79.1",
    "x-forwarded-proto": "https",
    "x-real-ip": "63.229.18.140"
  },
  "url": "https://echo.mirio.dev/",
  "method": "GET"
}
```
