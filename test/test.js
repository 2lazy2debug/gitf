/* eslint-env node, mocha */

'use strict'

let gitf = require('../index')
const nodegit = require('nodegit')
const promisify = require('promisify-node')
const semver = require('semver')
const fs = require('fs')
const path = require('path')
const rimraf = promisify(require('rimraf'))
const mkdir = promisify(fs.mkdir)

const PATH = path.join(process.cwd(), '/test/tmp')

let PACKAGE
let repository
let index

/**
 * create tmp git directory to run tests and initialize gitf
 */
before((done) => {
  rimraf(PATH)
  .then(() => {
    mkdir(PATH)
  })
  .then(() => {
    return nodegit.Repository.init(PATH, 0)
  })
  .then((repo) => {
    repository = repo
    fs.writeFile(PATH + '/package.json', `
      {
        "name": "tmp",
        "version": "0.1.0"
      }
    `)
  })
  .then(() => {
    return repository.refreshIndex()
  })
  .then((idx) => {
    index = idx
  })
  .then(() => {
    return index.addByPath('package.json')
  })
  .then(() => {
    return index.write()
  })
  .then(() => {
    return index.writeTree()
  })
  .then((oid) => {
    let author = nodegit.Signature.create('user', 'user@domain.com', 123456789, 60)
    return repository.createCommit('HEAD', author, author, 'message', oid, [])
  })
  .done(() => {
    PACKAGE = require(PATH + '/package.json')
    gitf = gitf({ path: PATH }, done)
  })
})

describe('Feature', () => {
  it('should be in branch feature-test', (done) => {
    gitf.run('create-feature', 'test', () => {
      nodegit.Reference.lookup(repository, 'refs/heads/feature-test')
      .then(() => {
        done()
      })
      .catch(() => {
        done('missing branch')
      })
    })
  })

  it('should merge with develop and delete feature branch', (done) => {
    gitf.run('incorporate-feature', 'test', () => {
      nodegit.Reference.lookup(repository, 'refs/heads/feature-test')
      .then(() => {
        done('branch still exist')
      })
      .catch(() => {
        done()
      })
    })
  })
})

describe('Release', () => {
  let nextRelVer

  it('should create a release branch', (done) => {
    gitf.run('create-release', () => {
      nextRelVer = semver.inc(PACKAGE.version, 'minor')
      nextRelVer = 'release-' + nextRelVer.substr(0, nextRelVer.lastIndexOf('.'))

      nodegit.Reference.lookup(repository, 'refs/heads/' + nextRelVer)
      .then(() => {
        done()
      })
      .catch(() => {
        done('missing branch')
      })
    })
  })

  it('should finish a release', (done) => {
    gitf.run('finish-release', nextRelVer.replace('release-', ''), () => {
      nodegit.Reference.lookup(repository, 'refs/heads/' + nextRelVer)
      .then(() => {
        done()
      })
      .catch(() => {
        done('branch do not exist')
      })
    })
  })
})

describe('Hotfix', () => {
  it('should create a hotfix branch', (done) => {
    gitf.run('create-hotfix', '0.2', () => {
      nodegit.Reference.lookup(repository, 'refs/heads/hotfix-0.2.1')
      .then(() => {
        done()
      })
      .catch(() => {
        done('missing hotfix branch')
      })
    })
  })

  it('should finish a hotfix branch', (done) => {
    gitf.run('finish-hotfix', '0.2.1', () => {
      nodegit.Reference.lookup(repository, 'refs/heads/hotfix-0.2.1')
      .then(() => {
        done('branch still exist')
      })
      .catch(() => {
        done()
      })
    })
  })
})

describe('Remove path', () => {
  it('should remove a path', (done) => {
    gitf.run('remove-path', 'dist', 'master', () => {
      done()
    })
  })
})

/**
 * remove tmp git directory after tests
*/
after((done) => {
  rimraf(PATH).done(done)
})
