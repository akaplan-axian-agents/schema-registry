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

Terraform uses the AzureRM backend so apply and teardown runs share state.
Create a storage account and blob container for Terraform state before running
the GitHub Actions workflows or local `terraform init`.

## Deploy

Create the registry first so there is a place to push the application image:

```sh
terraform -chdir=infra/terraform init \
  -backend-config="resource_group_name=<state-resource-group>" \
  -backend-config="storage_account_name=<state-storage-account>" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=schema-registry-dev.tfstate"
terraform -chdir=infra/terraform apply \
  -target=azurerm_resource_group.app \
  -target=azurerm_container_registry.app
```

Build and push the image expected by Terraform:

```sh
npm ci
npm run build
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

## GitHub Actions

The repository includes manually triggered Terraform workflows:

- `Terraform Apply` builds the minified server, creates the resource group and
  container registry, pushes the container image, then applies the full
  Container Apps deployment.
- `Terraform Teardown` destroys the Terraform-managed Azure resources.

The workflows authenticate with Azure using OIDC. Configure these repository
secrets before running them:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
```

Each workflow run also prompts for the AzureRM backend resource group, storage
account, blob container, and state key. Use the same backend values for apply
and teardown runs that manage the same deployment.
