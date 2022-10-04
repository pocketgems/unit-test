const fs = require('fs')

const { SummaryReporter } = require('@jest/reporters')
const chalk = require('chalk')
const table = require('chalk-table')
const stripAnsi = require('strip-ansi')
const wrap = require('word-wrap')

class CustomReporter extends SummaryReporter {
  constructor (...args) {
    super(...args)
    this.collectedLogs = []
  }

  static parseLogLines (logLines) {
    if (!logLines) {
      return new Proxy({}, {
        get: () => {
          return {}
        }
      })
    }
    const parsedLines = {}
    let currentSuite, currentTest
    for (let lineIndex = 0; lineIndex < logLines.length; lineIndex++) {
      const line = logLines[lineIndex]
      const suite = line.match(/.*Suite: (.*)/)
      if (suite) {
        currentSuite = suite[1]
        parsedLines[currentSuite] = parsedLines[currentSuite] || {}
        continue
      }

      const test = line.match(/.*Test: (.*)/)
      if (test) {
        currentTest = test[1]
        const currentData = parsedLines[currentSuite][currentTest]
        parsedLines[currentSuite][currentTest] = currentData || []
        continue
      }
      if (parsedLines[currentSuite][currentTest]) {
        parsedLines[currentSuite][currentTest].push(line)
      } else {
        console.log(line)
      }
    }
    return parsedLines
  }

  log (...columns) {
    const firstColumnWidth = 70
    let charsShort = firstColumnWidth - columns[0].length
    while (charsShort < 0) {
      charsShort += 30
    }
    columns[0] += ' '.repeat(charsShort)
    const line = columns.join('\t')
    this.collectedLogs.push(stripAnsi(line))
    super.log(line)
  }

  parseResults (results) {
    const parsedResults = {}
    results.forEach(result => {
      const suiteKey = result.ancestorTitles[0]
      parsedResults[suiteKey] = parsedResults[suiteKey] ||
        { __fileStats: this.emptyStats }
      const suite = parsedResults[suiteKey]
      const test = result.title
      suite.__fileStats.add(this.statsFromJestStatus(result.status))
      suite.__fileStats.time += result.duration
      suite[test] = result
    })
    return parsedResults
  }

  logLongLines (longLines, prefix, color) {
    prefix = prefix || ''
    longLines.split('\n').forEach(longLine => {
      wrap(longLine, {
        width: 120
      }).split('\n').forEach(line => {
        this.log(prefix + color(line))
      })
    })
  }

  static renderTime (expected, actual) {
    let timeText = `${actual}ms`
    let exceeded = false
    if (actual > expected * 2) {
      timeText = chalk.bold.red(timeText)
      exceeded = true
    } else if (actual > expected * 1.5) {
      timeText = chalk.bold.yellow(timeText)
      exceeded = true
    }

    if (exceeded) {
      timeText += ` >> expected ${Math.floor(expected)}ms`
    }
    return [timeText, exceeded]
  }

  logTestSuites (results, logs, avgTime) {
    const suiteKeys = Object.keys(results).sort()
    suiteKeys.forEach(suiteKey => {
      const suite = results[suiteKey]
      const expectedTime = avgTime * suite.__fileStats.total
      const totalTime = suite.__fileStats.time
      const [suiteTime, slowSuite] = this.constructor.renderTime(
        expectedTime,
        totalTime
      )

      const suiteStatus = suite.__fileStats.status()
      this.log(`  Suite: ${chalk.dim(suiteKey)}`, suiteStatus, suiteTime)
      if (!suite.__fileStats.pending &&
          !suite.__fileStats.failing &&
          !slowSuite) {
        return
      }

      const testKeys = Object.keys(suite).filter(testKey => {
        return testKey.startsWith('test')
      }).sort()
      testKeys.forEach(testKey => {
        const result = suite[testKey]
        const log = logs[suiteKey][testKey]
        const stats = this.statsFromJestStatus(result.status)
        const didFail = !!stats.failing

        const [testTime] = this.constructor.renderTime(
          avgTime, result.duration)
        this.log(
          `    Test: ${chalk.dim(result.title)}`,
          stats.status(),
          testTime)
        const prefix = '    '
        if (didFail) {
          if (log && log.length) {
            log.forEach(line => {
              this.logLongLines(line, prefix, chalk.dim)
            })
          }
          result.failureMessages.forEach(line => {
            this.logLongLines(line, prefix + '  ', chalk.red)
          })
        }
      })
    })
  }

  logTestSummary (runTime, results, stats) {
    let timeText = `${runTime}s`
    if (this._estimatedTime && runTime - 1 > this._estimatedTime) {
      timeText = chalk.bold.yellow(timeText)
    }
    this.log(
      chalk.bold('Tests finished in ') + timeText +
      (this._estimatedTime ? `, estimated ${this._estimatedTime}s` : ''))

    const options = {
      columns: [
        { field: 'name', name: '(index)' },
        { field: 'failing', name: 'Failed' },
        { field: 'pending', name: 'Skipped' },
        { field: 'passing', name: 'Passed' },
        { field: 'total', name: 'Total' }
      ]
    }

    Object.values(stats).forEach(stat => {
      stat.passing = chalk.green(stat.passing)
      stat.pending = stat.pending ? chalk.yellow(stat.pending) : 0
      stat.failing = stat.failing ? chalk.red(stat.failing) : 0
    })

    this.log(table(options, [
      stats.files,
      stats.suites,
      stats.tests
    ]))
  }

  get emptyStats () {
    return {
      passing: 0,
      pending: 0,
      failing: 0,
      total: 0,
      time: 0,
      add: function (other) {
        Object.keys(this).forEach(key => {
          if (typeof this[key] === 'number') {
            this[key] += other[key]
          }
        })
      },
      aggregate: function (other) {
        this.total += 1
        if (other.failing) {
          this.failing += 1
        } else if (other.passing) {
          this.passing += 1
        } else if (other.pending) {
          this.pending += 1
        }
      },
      status: function () {
        let status
        if (this.failing) {
          status = chalk.red('FAIL')
        } else if (this.passing) {
          status = chalk.green('OK')
        } else if (this.pending) {
          status = chalk.yellow('SKIPPED')
        } else {
          status = chalk.dim('NO TEST')
        }
        return status
      }
    }
  }

  extractStats (result) {
    const stats = this.emptyStats
    // Jest uses 2 naming schemes on (non)aggregated results.
    // One will have value the other will be 0.
    const ctrl = Object.prototype.hasOwnProperty.call(
      result,
      'numPassedTestSuites')
    stats.passing = ctrl ? result.numPassedTestSuites : result.numPassingTests
    stats.pending = ctrl ? result.numPendingTestSuites : result.numPendingTests
    stats.failing = ctrl ? result.numFailedTestSuites : result.numFailingTests
    stats.total = stats.passing + stats.pending + stats.failing
    return stats
  }

  statsFromJestStatus (status) {
    const stats = this.emptyStats
    stats.total++
    switch (status) {
      case 'passed':
        stats.passing++
        break
      case 'failed':
        stats.failing++
        break
      case 'pending':
        stats.pending++
        break
    }
    return stats
  }

  onRunComplete (ctx, results) {
    const runTime = ((Date.now() - results.startTime) / 1000).toFixed(2)
    const rootPath = ctx.values().next().value.config.rootDir
    // Jest supports running tests with multiple workers, which makes the time
    // elapsed to be much lower than the total time spent by all workers.
    // Go through individual test results to aggregate total time instead.
    const totalTime = results.testResults.reduce((total, result) => {
      return total + result.perfStats.end - result.perfStats.start
    }, 0)
    const avgTestTime = totalTime / results.numTotalTests

    const fileStats = this.extractStats(results)
    fileStats.name = 'Files'
    const stats = {
      tests: Object.assign({ name: 'Tests' }, this.emptyStats),
      suites: Object.assign({ name: 'Suites' }, this.emptyStats),
      files: fileStats
    }
    results.testResults.forEach(result => {
      // One result per file
      const testStats = this.extractStats(result)
      stats.tests.add(testStats)

      const status = testStats.status()
      const groupedTests = this.parseResults(result.testResults)
      for (const suite of Object.values(groupedTests)) {
        stats.suites.aggregate(suite.__fileStats)
      }

      const totalTime = result.perfStats.end - result.perfStats.start
      // There are some overhead for setting up each file
      const expectedTime = avgTestTime * testStats.total + 600
      const [timeText, slowFile] = this.constructor.renderTime(
        expectedTime, totalTime)
      const filepath = result.testFilePath.replace(rootPath, '...')
      this.log(`File: ${chalk.dim(filepath)}`, status, timeText)

      if (result.numPendingTests || result.numFailingTests || slowFile) {
        const groupedLogs = this.constructor.parseLogLines(result.logLines)
        this.logTestSuites(groupedTests, groupedLogs, avgTestTime)
      }
    })
    this.log('\n')
    this.logTestSummary(runTime, results, stats)

    const reportDirectory = this._globalConfig.coverageDirectory
    if (reportDirectory) {
      fs.mkdirSync(reportDirectory, { recursive: true })
      fs.writeFileSync(
        reportDirectory + '/unittest',
        this.collectedLogs.join('\n'))
    }
  }
}

module.exports = CustomReporter
