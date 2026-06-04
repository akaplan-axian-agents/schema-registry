# Azure Container Apps Deployment

This Terraform configuration provisions Azure resources for running the schema
registry as a containerized Azure Container App:

- Resource group
- Log Analytics workspace
- Azure Container Registry with admin credentials disabled
- Storage account and Azure Files share for persisted schema JSON
- Container Apps environment with the Azure Files share attached
- User-assigned managed identity with `AcrPull`
- Public HTTPS Container App running the schema registry image

## Prerequisites

- Azure CLI authenticated to the target subscription
- Docker or another OCI-compatible image builder
- Terraform 1.6 or newer

Set the subscription once per shell, or copy `terraform.tfvars.example` to
`terraform.tfvars` and set `subscription_id` there.

```sh
export ARM_SUBSCRIPTION_ID="<azure-subscription-id>"
```

## Deploy

Create the registry first so there is a place to push the application image:

```sh
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform apply \
  -target=azurerm_resource_group.app \
  -target=azurerm_container_registry.app
```

Build and push the image expected by Terraform:

```sh
az acr login --name "$(terraform -chdir=infra/terraform output -raw container_registry_login_server | cut -d. -f1)"
docker build --platform linux/amd64 \
  -t "$(terraform -chdir=infra/terraform output -raw container_image)" .
docker push "$(terraform -chdir=infra/terraform output -raw container_image)"
```

Apply the full deployment:

```sh
terraform -chdir=infra/terraform apply
terraform -chdir=infra/terraform output container_app_url
```

## Configuration

The Container App sets these runtime values:

```text
HOST=0.0.0.0
PORT=8080
SCHEMA_ROOT=/data/schemas
STATIC_ROOT=/app/src/static
VIEWS_ROOT=/app/views
LOCALES_ROOT=/app/locales
NODE_ENV=production
```

`/data/schemas` is mounted from Azure Files so schema create, update, and delete
operations survive restarts and new revisions. The default scale range is
`min_replicas = 0` and `max_replicas = 1`.

To deploy a new version, build and push a new image tag, update `image_tag`, and
run `terraform -chdir=infra/terraform apply`.
