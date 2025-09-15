{{/*
Expand the name of the chart.
*/}}
{{- define "jira-mcp-server.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "jira-mcp-server.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "jira-mcp-server.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "jira-mcp-server.labels" -}}
helm.sh/chart: {{ include "jira-mcp-server.chart" . }}
{{ include "jira-mcp-server.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "jira-mcp-server.selectorLabels" -}}
app.kubernetes.io/name: {{ include "jira-mcp-server.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "jira-mcp-server.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "jira-mcp-server.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the image name
*/}}
{{- define "jira-mcp-server.image" -}}
{{- if .Values.global.imageRegistry }}
{{- printf "%s/%s:%s" .Values.global.imageRegistry .Values.image.repository .Values.image.tag }}
{{- else }}
{{- printf "%s:%s" .Values.image.repository .Values.image.tag }}
{{- end }}
{{- end }}

{{/*
Create cloud-specific annotations for ingress
*/}}
{{- define "jira-mcp-server.ingressAnnotations" -}}
{{- if eq .Values.cloudProvider.provider "aws" }}
kubernetes.io/ingress.class: alb
alb.ingress.kubernetes.io/scheme: {{ .Values.cloudProvider.aws.alb.scheme | default "internal" }}
{{- if .Values.cloudProvider.aws.alb.certificateArn }}
alb.ingress.kubernetes.io/certificate-arn: {{ .Values.cloudProvider.aws.alb.certificateArn }}
{{- end }}
alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
alb.ingress.kubernetes.io/ssl-redirect: '443'
{{- else if eq .Values.cloudProvider.provider "azure" }}
kubernetes.io/ingress.class: azure/application-gateway
appgw.ingress.kubernetes.io/ssl-redirect: "true"
appgw.ingress.kubernetes.io/connection-draining: "true"
appgw.ingress.kubernetes.io/connection-draining-timeout: "30"
{{- else if eq .Values.cloudProvider.provider "gcp" }}
kubernetes.io/ingress.class: gce
kubernetes.io/ingress.allow-http: "false"
ingress.gcp.kubernetes.io/force-ssl-redirect: "true"
{{- if .Values.cloudProvider.gcp.cloudArmor.enabled }}
cloud.google.com/armor-config: '{"{{ .Values.cloudProvider.gcp.cloudArmor.policyName }}": "{{ .Values.cloudProvider.gcp.cloudArmor.policyName }}"}'
{{- end }}
{{- end }}
{{- end }}

{{/*
Create cloud-specific service annotations
*/}}
{{- define "jira-mcp-server.serviceAnnotations" -}}
{{- if eq .Values.cloudProvider.provider "aws" }}
service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
service.beta.kubernetes.io/aws-load-balancer-internal: "true"
{{- else if eq .Values.cloudProvider.provider "azure" }}
service.beta.kubernetes.io/azure-load-balancer-internal: "true"
{{- else if eq .Values.cloudProvider.provider "gcp" }}
cloud.google.com/load-balancer-type: "Internal"
networking.gke.io/load-balancer-type: "Internal"
{{- end }}
{{- end }}

{{/*
Create cloud-specific service account annotations
*/}}
{{- define "jira-mcp-server.serviceAccountAnnotations" -}}
{{- if eq .Values.cloudProvider.provider "aws" }}
{{- if .Values.cloudProvider.aws.roleArn }}
eks.amazonaws.com/role-arn: {{ .Values.cloudProvider.aws.roleArn }}
{{- end }}
{{- else if eq .Values.cloudProvider.provider "gcp" }}
{{- if .Values.cloudProvider.gcp.workloadIdentity.enabled }}
iam.gke.io/gcp-service-account: {{ .Values.cloudProvider.gcp.workloadIdentity.serviceAccount }}
{{- end }}
{{- end }}
{{- end }}