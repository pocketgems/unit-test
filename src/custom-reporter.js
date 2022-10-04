// adapted from https://github.com/facebook/jest/issues/4156#issuecomment-490764080
const { getConsoleOutput } = require('@jest/console')
const { DefaultReporter } = require('@jest/reporters/build')

class CustomReporter extends DefaultReporter {
  printTestFileHeader (testPath, config, result) {
    const consoleBuffer = result.console
    const testFailed = result.numFailingTests > 0
    if (testFailed && consoleBuffer && consoleBuffer.length) {
      result.failureMessage = '' // Remove aggregated failure message
      consoleBuffer.forEach(entry => {
        // Completely nuke any info recorded by jest on where the log came
        // from. The log messages themselves are already stack traces and error
        // infos. The stack trace provided by jest shows where we are logging
        // the stack traces, which is beyond useless.
        entry.origin = ''
      })
      const lines = getConsoleOutput(
        config.cwd,
        !!this._globalConfig.verbose,
        consoleBuffer
      ).split('\n')
      // don't print the location of console.log statements (it might be better
      // to accomplish this with a custom console) because we have our own
      // custom logger which better handles this (since fastify.log goes
      // through pino, not console)
      const newLines = []
      let extractedLines = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line || line.indexOf('console.') !== -1) {
          continue
        }

        // Take all "Expecting" lines below the next non-"Expecting" line
        if (line.indexOf('\u2502 Expecting') !== -1) {
          extractedLines.push(line.slice(4))
          continue
        }
        newLines.push(line.slice(4))
        if (extractedLines.length) {
          newLines.push(...extractedLines)
          extractedLines = []
        }
      }
      result.logLines = newLines
    }
  }
}

module.exports = CustomReporter
