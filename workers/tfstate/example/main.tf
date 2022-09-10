terraform {
  backend "http" {
    address        = "https://apigw.eragon.xyz/tfstate/states/tfstate-example"
    lock_address   = "https://apigw.eragon.xyz/tfstate/states/tfstate-example/lock"
    lock_method    = "PUT"
    unlock_address = "https://apigw.eragon.xyz/tfstate/states/tfstate-example/lock"
    unlock_method  = "DELETE"
    username       = "e0f30419b4cca01ba2931345a61cc592.access"
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
