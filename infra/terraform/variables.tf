variable "subscription_id" {
  description = "Azure subscription ID. May be omitted when ARM_SUBSCRIPTION_ID is set in the environment."
  type        = string
  default     = null
}

variable "name_prefix" {
  description = "Short prefix used for Azure resource names."
  type        = string
  default     = "schemaregistry"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,13}$", var.name_prefix))
    error_message = "name_prefix must start with a lowercase letter and contain 3 to 14 lowercase letters or numbers."
  }
}

variable "environment" {
  description = "Deployment environment label used in names and tags."
  type        = string
  default     = "test"

  validation {
    condition     = contains(["test", "prod"], var.environment)
    error_message = "environment must be either test or prod."
  }
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "eastus"
}

variable "image_name" {
  description = "Repository name for the schema registry image in Azure Container Registry."
  type        = string
  default     = "schema-registry"
}

variable "image_tag" {
  description = "Container image tag to run in Azure Container Apps."
  type        = string
  default     = "latest"
}

variable "container_port" {
  description = "Port exposed by the Node container."
  type        = number
  default     = 8080

  validation {
    condition     = var.container_port > 0 && var.container_port < 65536
    error_message = "container_port must be between 1 and 65535."
  }
}

variable "cpu" {
  description = "Container Apps CPU allocation."
  type        = number
  default     = 0.25
}

variable "memory" {
  description = "Container Apps memory allocation."
  type        = string
  default     = "0.5Gi"
}

variable "min_replicas" {
  description = "Minimum active Container Apps replicas."
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum active Container Apps replicas."
  type        = number
  default     = 1

  validation {
    condition     = var.max_replicas >= var.min_replicas
    error_message = "max_replicas must be greater than or equal to min_replicas."
  }
}

variable "storage_share_quota_gb" {
  description = "Azure Files share quota for persisted schema documents."
  type        = number
  default     = 5

  validation {
    condition     = var.storage_share_quota_gb >= 1
    error_message = "storage_share_quota_gb must be at least 1."
  }
}

variable "log_retention_days" {
  description = "Retention period for Log Analytics workspace data."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags applied to Azure resources."
  type        = map(string)
  default     = {}
}
