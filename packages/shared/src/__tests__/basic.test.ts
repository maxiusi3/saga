describe('Basic Shared Tests', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2)
  })

  test('should handle TypeScript types', () => {
    interface TestType {
      id: string
      name: string
    }
    
    const testObj: TestType = {
      id: '123',
      name: 'test'
    }
    
    expect(testObj.id).toBe('123')
    expect(testObj.name).toBe('test')
  })
})