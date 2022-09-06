terraform {
  backend "http" {
    address        = "https://tfstate.mirio.dev/states/tfstate-example"
    lock_address   = "https://tfstate.mirio.dev/states/tfstate-example/lock"
    lock_method    = "PUT"
    unlock_address = "https://tfstate.mirio.dev/states/tfstate-example/lock"
    unlock_method  = "DELETE"
    username       = "cole@mirio.dev"
  }

  required_providers {
    http = {
      source  = "hashicorp/http"
      version = "3.0.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.3.2"
    }
  }
}

resource "random_pet" "server" {

}

output "pet" {
  value = random_pet.server.id
}

resource "random_password" "server" {
  length = 14
}

output "pwd" {
  value     = random_password.server.result
  sensitive = true
}
