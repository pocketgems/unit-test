const { Example } = require('../example/feature')
const { BaseTest, runTests } = require('../src/test')

class ExampleTest extends BaseTest {
  testMultiply () {
    expect(Example.multiply(2, 3)).toBe(6)
  }

  testInvalidCall () {
    expect(() => Example.broken()).toThrow()
  }

  async testCatchError () {
    const shouldThrow = () => {
      throw new Error('hello!')
    }
    const error = await this.catchError(shouldThrow)
    expect(error.message).toEqual('hello!')
    const doesNotThrow = () => 2
    await expect(this.catchError(doesNotThrow))
      .rejects.toThrow()
  }
}

runTests(ExampleTest)
