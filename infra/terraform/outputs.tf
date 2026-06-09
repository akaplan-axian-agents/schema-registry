output "resource_group_name" {
  description = "Azure resource group containing the schema registry deployment."
  value       = azurerm_resource_group.app.name
}

output "container_registry_login_server" {
  description = "Azure Container Registry login server."
  value       = azurerm_container_registry.app.login_server
}

output "container_image" {
  description = "Fully-qualified container image expected by the Container App."
  value       = local.container_image
}

output "container_app_name" {
  description = "Azure Container App name."
  value       = azurerm_container_app.app.name
}

output "container_app_fqdn" {
  description = "Latest revision FQDN for the Azure Container App."
  value       = azurerm_container_app.app.latest_revision_fqdn
}

output "container_app_url" {
  description = "HTTPS URL for the Azure Container App."
  value       = "https://${azurerm_container_app.app.latest_revision_fqdn}"
}

output "schema_storage_share_name" {
  description = "Azure Files share mounted at /data/schemas in the container."
  value       = azurerm_storage_share.schemas.name
}
