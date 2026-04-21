# `jwt`

Local-first JWT debugger at [`jwt.mirio.dev`](https://jwt.mirio.dev). Decode,
inspect, verify, and re-sign JSON Web Tokens. All crypto runs in the browser
via WebCrypto — your token and secret never leave the page.

## Features

- Decode any JWT (header, payload, signature)
- Verify HS256 / HS384 / HS512 signatures with a shared secret
- Re-sign — edit the header or payload and watch the encoded token update
- Claim decoration: `iat`, `nbf`, `exp` rendered as ISO timestamps with
  relative time and expiry warnings

## Not yet supported

RS\*, PS\*, ES\*, and EdDSA tokens decode correctly but are not verified or
re-signed. PEM-based asymmetric key import is on the to-do list.
