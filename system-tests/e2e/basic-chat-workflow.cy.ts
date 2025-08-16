describe('Charm-MCP Application Workflow', () => {
  beforeEach(() => {
    cy.intercept('POST', 'http://localhost:5173/api/chat-artifacts').as('chatArtifacts');
    cy.visit('/', { timeout: 30000 })
  })

  it('should be able to interact with the chat input', () => {
    cy.get('button[title="Settings"]').click()
    cy.get('button[title="Use Ollama"]').click()

    cy.get('button[title="Server Status"]').click()
    cy.get('div').contains("Loading server status...").should('not.exist');
    cy.get('[data-test="mcp-status-modal"]')
      .find('[data-test="mcp-server-button"]')
      .click({multiple: true})
    
    // Needs to force the button to click since it is not visible on the screen intentionally
    cy.get('[data-test="mcp-status-modal"]')
      .contains('button', 'Close')
      .click({force: true})

    const testMessage = 'Hello, this is a test message'
    
    cy.get('textarea').first().should('be.visible').and('not.be.disabled')
    
    cy.get('textarea').first().type(testMessage).type('{enter}');
    cy.get('span').contains("Assistant").should('exist')
    cy.get('span').contains("Processing request...").should('exist')
    cy.wait('@chatArtifacts', {responseTimeout: 60000});
    cy.get('span').contains("Using model provider: ollama").should('exist')
    cy.get('span').contains("Response complete").should('exist');
  })
}) 