const { Example } = require('../example/feature')
const { BaseTest, runTests } = require('../src/test')

class ExampleTest extends BaseTest {
  testMultiply () {
    expect(Example.multiply(2, 3)).toBe(6)
  }

  testInvalidCall () {
    expect(() => Example.broken()).toThrow()
  }
}

runTests(ExampleTest)
