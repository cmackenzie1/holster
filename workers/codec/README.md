# `codec`

Text encoder/decoder at [`codec.mirio.dev`](https://codec.mirio.dev). All processing runs
client-side in the browser — input is never sent to the server.

## Supported operations

| Codec | Notes |
| --- | --- |
| Base64 | Standard RFC 4648 |
| Base64 URL | URL-safe alphabet, padding optional |
| Base32 | RFC 4648 (TOTP/OTP secrets) |
| Hex | Tolerates whitespace, `:`, `-` separators |
| Binary | 8-bit groups, decode ignores non-`0`/`1` |
| URL | `encodeURIComponent` / `decodeURIComponent` |
| HTML entities | `& < > " '` plus numeric references on decode |
| Unicode escape | `\uXXXX` / `\u{X…}`, ASCII passes through |
| JSON | Pretty-print or minify |
