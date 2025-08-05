describe('Charm-MCP Application Workflow', () => {
    beforeEach(() => {
      cy.visit('/', { timeout: 30000 })
    })
  
    it('should load the mcp server correctly', () => {
      cy.get('body').should('be.visible')
      cy.title().should('not.be.empty')
      
      cy.get('button[title="Server Status"]').click()
      cy.get('div').contains("Loading server status...").should('not.exist');
      cy.get('[data-test="mcp-status-modal"]')
        .find('[data-test="mcp-server-button"]')
        .click({multiple: true})
    })
  }) 