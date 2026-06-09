resource "random_string" "suffix" {
  length  = 6
  lower   = true
  numeric = true
  special = false
  upper   = false
}

locals {
  resource_name           = "${var.name_prefix}-${var.environment}"
  unique_resource_name    = "${local.resource_name}-${random_string.suffix.result}"
  compact_resource_name   = "${var.name_prefix}${var.environment}${random_string.suffix.result}"
  container_registry_name = local.compact_resource_name
  storage_account_name    = local.compact_resource_name
  container_image         = "${azurerm_container_registry.app.login_server}/${var.image_name}:${var.image_tag}"

  tags = merge(
    {
      application = "schema-registry"
      environment = var.environment
      managed_by  = "terraform"
    },
    var.tags,
  )
}

resource "azurerm_resource_group" "app" {
  name     = local.unique_resource_name
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "app" {
  name                = local.unique_resource_name
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.tags
}

resource "azurerm_container_registry" "app" {
  name                = local.container_registry_name
  resource_group_name = azurerm_resource_group.app.name
  location            = azurerm_resource_group.app.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.tags
}

resource "azurerm_storage_account" "app" {
  name                            = local.storage_account_name
  resource_group_name             = azurerm_resource_group.app.name
  location                        = azurerm_resource_group.app.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true
  tags                            = local.tags
}

resource "azurerm_storage_share" "schemas" {
  name               = "schemas"
  storage_account_id = azurerm_storage_account.app.id
  quota              = var.storage_share_quota_gb
  access_tier        = "TransactionOptimized"
}

resource "azurerm_container_app_environment" "app" {
  name                       = local.unique_resource_name
  location                   = azurerm_resource_group.app.location
  resource_group_name        = azurerm_resource_group.app.name
  logs_destination           = "log-analytics"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.app.id
  tags                       = local.tags
}

resource "azurerm_container_app_environment_storage" "schemas" {
  name                         = "schemas"
  container_app_environment_id = azurerm_container_app_environment.app.id
  account_name                 = azurerm_storage_account.app.name
  share_name                   = azurerm_storage_share.schemas.name
  access_key                   = azurerm_storage_account.app.primary_access_key
  access_mode                  = "ReadWrite"
}

resource "azurerm_user_assigned_identity" "container_app" {
  name                = local.unique_resource_name
  resource_group_name = azurerm_resource_group.app.name
  location            = azurerm_resource_group.app.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                            = azurerm_container_registry.app.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_user_assigned_identity.container_app.principal_id
  principal_type                   = "ServicePrincipal"
  skip_service_principal_aad_check = true
}

resource "azurerm_container_app" "app" {
  name                         = local.unique_resource_name
  container_app_environment_id = azurerm_container_app_environment.app.id
  resource_group_name          = azurerm_resource_group.app.name
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.container_app.id]
  }

  registry {
    server   = azurerm_container_registry.app.login_server
    identity = azurerm_user_assigned_identity.container_app.id
  }

  ingress {
    external_enabled           = true
    target_port                = var.container_port
    transport                  = "http"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    volume {
      name         = "schemas"
      storage_name = azurerm_container_app_environment_storage.schemas.name
      storage_type = "AzureFile"
    }

    container {
      name   = "schema-registry"
      image  = local.container_image
      cpu    = var.cpu
      memory = var.memory

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "PORT"
        value = tostring(var.container_port)
      }

      env {
        name  = "SCHEMA_ROOT"
        value = "/data/schemas"
      }

      env {
        name  = "STATIC_ROOT"
        value = "/app/src/static"
      }

      env {
        name  = "VIEWS_ROOT"
        value = "/app/views"
      }

      env {
        name  = "LOCALES_ROOT"
        value = "/app/locales"
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      volume_mounts {
        name = "schemas"
        path = "/data/schemas"
      }

      startup_probe {
        transport               = "HTTP"
        port                    = var.container_port
        path                    = "/healthz"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 12
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = var.container_port
        path                    = "/healthz"
        initial_delay           = 30
        interval_seconds        = 30
        timeout                 = 5
        failure_count_threshold = 3
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = var.container_port
        path                    = "/healthz"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 3
      }
    }
  }

  depends_on = [
    azurerm_role_assignment.acr_pull,
  ]
}
