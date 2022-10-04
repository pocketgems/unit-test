class Example {
  static multiply (a, b) {
    return a * b
  }

  static broken () {
    this.invalid()
  }

  // istanbul ignore next
  static ignored () {

  }
}

module.exports = { Example }
