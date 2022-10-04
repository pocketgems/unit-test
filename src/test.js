if (Number(process.env.INDEBUGGER)) {
  jest.setTimeout(30 * 60 * 1000)
}

class BaseTest {
  _listTestsOn (obj) {
    return Object.getOwnPropertyNames(obj).filter(name => {
      if (!name.startsWith('test')) {
        // Exclude non-test functions
        return false
      }
      if (typeof obj[name] !== 'function') {
        // Exclude non-functions
        return false
      }
      return true
    })
  }

  _listTests () {
    let tests = []
    tests = tests.concat(this._listTestsOn(this))
    let proto = Object.getPrototypeOf(this)
    while (proto) {
      tests = tests.concat(this._listTestsOn(proto))
      proto = Object.getPrototypeOf(proto)
    }
    return tests
  }

  _genTestName (funcName) {
    // testExample123ABBRs => test example 123 abbrs (testExample123ABBRs)
    let testName = funcName.replace(/([A-Z]+)/g, str => ' ' + str.toLowerCase())
    testName = testName.replace(/[a-z]([0-9]+)/g,
      str => str[0] + ' ' + str.slice(1))
    return testName + ` (${funcName})`
  }

  async beforeAll () {}
  async afterAll () {}
  async beforeEach () {}
  async afterEach () {}

  runTests () {
    describe(this.constructor.name, () => {
      beforeAll(async () => {
        console.log(`Suite: ${this.constructor.name}`)
        await this.beforeAll()
      })

      afterAll(async () => {
        await this.afterAll()
      })

      beforeEach(async () => {
        await this.beforeEach()
      })

      afterEach(async () => {
        await this.afterEach()
      })

      this._listTests().forEach(funcName => {
        const testOnly = funcName.startsWith('testOnly')
        const testFunc = testOnly ? global.fit : global.it
        testFunc(funcName, () => {
          // Although test func has the same signature it requires `() => {}`,
          // we must wrap a closure so the invocation comes from test, which
          // makes references to `this` within the test func functional.
          console.log(`  ${testOnly ? 'Only Test' : 'Test'}: ${funcName}`)
          return this[funcName]()
        })
      })
    })
  }
}

function runTests () {
  const testSuites = arguments
  for (let i = 0; i < testSuites.length; i++) {
    const TestSuiteCls = testSuites[i]
    const testSuite = new TestSuiteCls()
    testSuite.runTests()
  }
}

module.exports = { BaseTest, runTests }
