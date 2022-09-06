# `tfstate` ⛏

Managed Terraform state using the [`http` backend](https://www.terraform.io/language/settings/backends/http), backed by Cloudflare Workers. Oh, and it supports locking 🔒.

## Getting Started

```terraform
terraform {
  backend "http" {
    address        = "https://tfstate.mirio.dev/states/your-project-name"
    lock_address   = "https://tfstate.mirio.dev/states/your-project-name/lock"
    lock_method    = "PUT" # also supports "LOCK"
    unlock_address = "https://tfstate.mirio.dev/e/states/your-project-name/lock"
    unlock_method  = "DELETE" # also supports "UNLOCK"
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
curl https://tfstate.mirio.dev/states/your-project-name/lock

# Manually remove the lock (similar to `terraform force-unlock`)
curl -X DELETE https://tfstate.mirio.dev/states/your-project-name/lock
```

### I get a 400 Error when attempting to lock

Double check you are using UPPER case values for `lock_method` and `unlock_method`.
