variable "subscription_id" {
  description = "Azure subscription ID. May be omitted when ARM_SUBSCRIPTION_ID is set in the environment."
  type        = string
  default     = null
}

variable "name_prefix" {
  description = "Short prefix used for Azure resource names."
  type        = string
  default     = "schema-registry"

  validation {
    condition     = length(var.name_prefix) >= 3 && length(var.name_prefix) <= 31 && can(regex("^[A-Za-z][0-9A-Za-z-]*[0-9A-Za-z]$", var.name_prefix))
    error_message = "name_prefix must start with a letter, end with a letter or number, and contain 3 to 31 letters, numbers, or hyphens."
  }
}

variable "environment" {
  description = "Deployment environment label used in names and tags."
  type        = string
  default     = "dev"

  validation {
    condition     = length(var.environment) >= 2 && length(var.environment) <= 20 && can(regex("^[0-9a-z][0-9a-z-]*[0-9a-z]$", var.environment))
    error_message = "environment must start and end with a lowercase letter or number and contain 2 to 20 lowercase letters, numbers, or hyphens."
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
