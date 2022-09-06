# `hash` #️⃣

POST data and get the `sha256`, `md5` or other supported hash back! Data is returned as the hex encoding of the final digest.

**Note:** When using `curl`, be sure to use `--data-binary` to prevent `curl` from transforming the data before sending it.

```
curl -XPOST https://hash.mirio.dev/md5 --data-binary @data.bin
c27830b0f2af9af174da9b25e56be6ff

curl -XPOST https://hash.mirio.dev/sha256 --data-binary @data.bin
d457d2a4c60670d56b6cf5ed36a362d99041f37cc68b91297eecd06de5870301
```

### Supported algorithms

- `md5`
- `sha1`
- `sha256`
- `sha384`
- `sha512`
