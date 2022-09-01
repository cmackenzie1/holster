# `tfstate` ⛏

Managed Terraform state using the [`http` backend](https://www.terraform.io/language/settings/backends/http), backed by Cloudflare Workers. Oh, and it supports locking 🔒.

## Getting Started

```terraform
terraform {
  backend "http" {
    address        = "https://tfstate.mirio.dev/example/v1"
    lock_address   = "https://tfstate.mirio.dev/example/v1/lock"
    lock_method    = "PUT"
    unlock_address = "https://tfstate.mirio.dev/example/v1/lock"
    unlock_method  = "DELETE"
    username       = "you@example.com"
    password       = "yourPassword"
  }
}
```

## Troubleshooting

Got yourself in a tfstate*tastrophy*? The following commands may help.

**NOTE: These can be destructive, so be careful!**

### My state is locked, how can I unlock it?

```curl
# Get current lock info
curl https://tfstate.mirio.dev/example/tfstate/lock

# Manually remove the lock (similar to `terraform force-unlock`)
curl -X DELETE https://tfstate.mirio.dev/example/tfstate/lock
```

### I get a 400 Error when attempting to lock

Double check you are using UPPER case values for `lock_method` and `unlock_method`.
