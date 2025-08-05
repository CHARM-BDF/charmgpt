describe('Charm-MCP Application Workflow', () => {
  beforeEach(() => {
    cy.visit('/', { timeout: 30000 })
  })

  it('should load the chat interface successfully', () => {
    cy.get('body').should('be.visible')
    cy.title().should('not.be.empty')
    
    cy.get('textarea').should('exist')
  })

  it('should have working navigation to select llm models and options', () => {
    cy.get('button[title="Settings"]').click()

    cy.get('[data-test="model-selection"]')
      .within(($element) => {
        ['Ollama','Gemini', 'Claude'].forEach(model => {
          cy.wrap($element).contains(model);
        });
      })
    
    cy.get('button[title="Switch to dark mode"]').should('exist');
    cy.get('button[title="File Manager"]').should('exist');
  })
}) 