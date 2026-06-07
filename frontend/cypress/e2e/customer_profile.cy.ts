describe('Customer Profile - My Hairdresser', () => {
  const token = 'test.jwt.token'

  beforeEach(() => {
    // Simulate login token
    cy.window().then((win) => {
      win.localStorage.setItem('token', token)
    })
  })

  it('Test 1: shows stylist name and specialty when preferred stylist exists', () => {
    cy.intercept('GET', '/api/customers/me', {
      statusCode: 200,
      body: {
        id: 1,
        name: 'علی',
        preferredEmployee: {
          id: 5,
          name: 'مهدی',
          specialty: 'کوتاهی مو',
          avatarUrl: null,
        },
      },
    }).as('getProfile1')

    cy.visit('/dashboard/customer')
    cy.wait('@getProfile1')
    cy.contains('آرایشگر من').should('exist')
    cy.contains('مهدی').should('exist')
    cy.contains('کوتاهی مو').should('exist')
  })

  it('Test 2: shows team fallback text with default stylist present', () => {
    cy.intercept('GET', '/api/customers/me', {
      statusCode: 200,
      body: {
        id: 2,
        name: 'سارا',
        preferredEmployee: {
          id: 7,
          name: 'نازنین',
          specialty: 'رنگ و لایت',
          avatarUrl: null,
        },
      },
    }).as('getProfile2')

    cy.visit('/dashboard/customer')
    cy.wait('@getProfile2')
    cy.contains('آرایشگر من').should('exist')
    cy.contains('نازنین').should('exist')
    cy.contains('رنگ و لایت').should('exist')
  })

  it('Test 3: no stylist and no default -> shows only team fallback', () => {
    cy.intercept('GET', '/api/customers/me', {
      statusCode: 200,
      body: {
        id: 3,
        name: 'لیلا',
        preferredEmployee: null,
      },
    }).as('getProfile3')

    cy.visit('/dashboard/customer')
    cy.wait('@getProfile3')
    cy.contains('آرایشگر من').should('exist')
    cy.contains('تیم سالن').should('exist')
  })
})


