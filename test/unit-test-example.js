const { Example } = require('../example/feature')
const { BaseTest, runTests } = require('../src/test')

class CustomError extends Error {
  constructor(message, customData) {
    super(message)
    this.customData = customData
  }
}

class ExampleTest extends BaseTest {
  testMultiply () {
    expect(Example.multiply(2, 3)).toBe(6)
  }

  testInvalidCall () {
    expect(() => Example.broken()).toThrow()
  }

  async testCatchError () {
    const shouldThrow = () => {
      throw new CustomError('hello!', {
        a: 33,
        b: [1,2]
      })
    }
    const error = await this.catchError(shouldThrow)
    expect(error).toBeInstanceOf(CustomError)
    expect(error.message).toEqual('hello!')
    expect(error.customData).toEqual({
      a: 33,
      b: [1,2]
    })
    const doesNotThrow = () => 2
    await expect(this.catchError(doesNotThrow))
      .rejects.toThrow()
  }
}

runTests(ExampleTest)
