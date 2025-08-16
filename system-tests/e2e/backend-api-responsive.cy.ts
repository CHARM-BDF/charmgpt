import type { ServiceStatus } from '../support/types'

describe('Charm-MCP Application Workflow', () => {
  const config = {
    baseUrl: 'http://localhost:5173',
    ollamaUrl: 'http://localhost:11434',
    backendUrl: 'http://localhost:3001',
    timeout: 10000
  }

  beforeEach(() => {
    cy.visit('/', { timeout: 30000 })
  })

  it('should verify backend API is responsive for chat functionality', () => {
    cy.request<ServiceStatus>({
      url: `${config.backendUrl}/api/server-status`,
      timeout: config.timeout,
      failOnStatusCode: false
    }).should(response => {
      expect(response.status).to.equal(200);
    });
    
    cy.request({
      url: `${config.backendUrl}/api/chat-basic`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        message: 'Test message',
        model: 'ollama'
      },
      timeout: config.timeout,
      failOnStatusCode: false
    }).should(response => {
      expect(response.status).to.equal(200)
    });
  })
}) 