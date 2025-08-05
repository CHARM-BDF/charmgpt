/// <reference types="cypress" />

export interface OllamaModel {
  name: string
  size: number
  modified_at: string
  digest: string
}

export interface ServiceStatus {
  status: 'running' | 'stopped' | 'error'
  port: number
  url: string
}

export interface TestConfig {
  baseUrl: string
  ollamaUrl: string
  backendUrl: string
  timeout: number
} 