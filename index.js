'use strict'

const simpleGit = require('simple-git')
const program = require('commander')
const semver = require('semver')
const exec = require('child_process').exec
const fs = require('fs')

let PACKAGE
let git

const _options = {

  /**
   * working path
   * @type {string}
   */
  path: process.cwd(),

  /**
   * clean screen
   * @type {Boolean}
   */
  clearScreen: false,

  /**
   * enable/disable commander
   * @type {Boolean}
   */
  commander: true,

  /**
   * error messages
   * @type {Object}
   */
  msg: {
    missingGit: 'Please run "git init" to create a repository.',
    missingMaster: 'Please run "git add . && git commit -a".',
    missingPackage: 'Please run "npm init" to create a npm package.'
  },

  /**
   * templates
   * @type {Object}
   */
  tmpl: {

    /**
     * Create a feature branch from develop.
     */
    'create-feature': {
      command: 'create-feature',
      description: 'Create a new feature branch from develop',
      options: [],
      arguments: '<name>',
      examples: [
        '$ gitf create-feature experiment'
      ],
      validate: (name, cb) => {
        if (typeof name === 'string') {
          cb(undefined)
        } else {
          cb('missing name')
        }
      },
      template: (name, cb) => {
        cb(`git checkout -b feature-${name} develop`)
      }
    },

    /**
     * Merge the feature branch in develop
     * and delete the feature branch.
     */
    'incorporate-feature': {
      command: 'incorporate-feature',
      description: 'Incorporate a finished feature on develop',
      options: [],
      arguments: '<name>',
      examples: [
        '$ gitf incorporate-feature experiment'
      ],
      validate: (name, cb) => {
        if (typeof name === 'string') {
          git.branch((err, resp) => {
            if (err) {
              cb(err)
            } else if (!resp.branches['feature-' + name]) {
              cb('feature-' + name + ' branch do not exist')
            } else {
              cb(undefined)
            }
          })
        } else {
          cb('missing name')
        }
      },
      template: (name, cb) => {
        cb(
          `git checkout develop &&
          git merge feature-${name} &&
          git branch -d feature-${name}`
        )
      }
    },

    /**
     * Bump version, tag commit and create a release branch from develop.
     */
    'create-release': {
      command: 'create-release',
      description: 'Create a new release branch from develop',
      options: [],
      arguments: '[version]',
      examples: [
        '$ gitf create-release minor',
        '$ gitf create-release major'
      ],
      validate: (level, cb) => {
        cb = cb || level
        cb(undefined)
      },
      template: (level, cb) => {
        level = ['minor', 'major'].indexOf(level) === -1 ? 'minor' : level
        let nextReleaseVersion = semver.inc(PACKAGE.version, level) + '-rc.1'
        let branchName = nextReleaseVersion.substr(0, nextReleaseVersion.lastIndexOf('-'))

        branchName = branchName.substr(0, branchName.lastIndexOf('.'))
        PACKAGE.version = nextReleaseVersion
        git.checkout('develop', () => {
          fs.writeFileSync(_options.path + '/package.json', JSON.stringify(PACKAGE, null, 4))
          cb(
            `git commit -a -m "bumped version number to ${nextReleaseVersion}" &&
            git tag ${nextReleaseVersion} &&
            git checkout -b release-${branchName} develop`
          )
        })
      }
    },

    /**
     * Bump version and merge the release branch with develop and master.
     */
    'finish-release': {
      command: 'finish-release',
      description: 'Merge a finished release with develop and master',
      options: [],
      arguments: '<version>',
      examples: [
        '$ gitf finish-release 1.0'
      ],
      validate: (version, cb) => {
        if (typeof version === 'string') {
          git.branch((err, resp) => {
            if (err) {
              cb(err)
            } else if (!resp.branches['release-' + version]) {
              cb('release-' + version + ' branch do not exist')
            } else {
              cb(undefined)
            }
          })
        } else {
          cb('missing version')
        }
      },
      template: (input, cb) => {
        let level = ['minor', 'major'].indexOf(input.version) === -1 ? 'minor' : input.version
        let nextReleaseVersion = semver.inc(PACKAGE.version, level)

        PACKAGE.version = nextReleaseVersion
        git.checkout(`release-${nextReleaseVersion.substr(0, nextReleaseVersion.lastIndexOf('.'))}`, () => {
          fs.writeFileSync(_options.path + '/package.json', JSON.stringify(PACKAGE, null, 4))
          cb(
            `git commit -a -m "bumped version number to ${nextReleaseVersion}" &&
            git tag ${nextReleaseVersion} &&
            git checkout develop &&
            git merge release-${nextReleaseVersion.substr(0, nextReleaseVersion.lastIndexOf('.'))} &&
            git checkout master &&
            git merge release-${nextReleaseVersion.substr(0, nextReleaseVersion.lastIndexOf('.'))}`
          )
        })
      }
    },

    /**
     * Create a hotfix branch from a release branch.
     */
    'create-hotfix': {
      command: 'create-hotfix',
      description: 'Creating a hotfix branch for a release',
      options: [],
      arguments: '<release>',
      examples: [
        '$ gitf create-hotfix 1.0'
      ],
      validate: (release, cb) => {
        if (typeof release === 'string') {
          git.branch((err, resp) => {
            if (err) {
              cb(err)
            } else if (!resp.branches['release-' + release]) {
              cb('release-' + release + ' branch do not exist')
            } else {
              cb(undefined)
            }
          })
        } else {
          cb('missing release branch name')
        }
      },
      template: (release, cb) => {
        let patchVersion = semver.inc(release + '.0', 'patch')
        cb(`git checkout -b hotfix-${patchVersion} release-${release}`)
      }
    },

    /**
     * Bump version, tag commit
     * and merge the hotfix branch with release and develop branch.
     */
    'finish-hotfix': {
      command: 'finish-hotfix',
      description: 'Merge a finished hotfix with release and develop',
      options: [],
      arguments: '<version>',
      examples: [
        '$ gitf finish-hotfix 1.0.1'
      ],
      validate: (version, cb) => {
        if (typeof version === 'string') {
          git.branch((err, resp) => {
            if (err) {
              cb(err)
            } else if (!resp.branches['hotfix-' + version]) {
              cb('hotfix-' + version + ' branch do not exist')
            } else {
              cb(undefined)
            }
          })
        } else {
          cb('missing hotfix branch name')
        }
      },
      template: (version, cb) => {
        PACKAGE.version = version
        fs.writeFileSync(_options.path + '/package.json', JSON.stringify(PACKAGE, null, 4))
        cb(
          `git commit -a -m "bumped version number to ${version}" &&
          git tag ${version} &&
          git checkout release-${version.substr(0, version.lastIndexOf('.'))} &&
          git merge hotfix-${version} &&
          git checkout develop &&
          git merge hotfix-${version} &&
          git branch -d hotfix-${version}`
        )
      }
    },

    /**
     * Remove a path from git history for a specific branch.
     */
    'remove-path': {
      command: 'remove-path',
      description: 'Remove a path from git history for specific branch',
      options: [],
      arguments: '<path> <branch>',
      examples: [
        '$ gitf remove-path ./experiment master'
      ],
      validate: (path, branch, cb) => {
        if (typeof path === 'string' && typeof branch === 'string') {
          cb(undefined)
        } else {
          cb('missing path or branch')
        }
      },
      template: (path, branch, cb) => {
        cb(
          `git checkout ${branch}
          git filter-branch --tree-filter 'rm -rf ${path}' --prune-empty HEAD &&
          git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d &&
          git gc`
        )
      }
    }
  }
}

/**
 * constructor
 * @param  {Object}   options
 * @param  {Function} cb
 * @return {Object}
 */
module.exports = (options, cb) => {
  cb = cb || function () {}

  if (_options.clearScreen) {
    process.stdout.write('\u001b[2J\u001b[0;0H')
  }

  if (options) {
    _options.commander = false
  }

  Object.assign(_options, options)

  git = simpleGit(_options.path)
  PACKAGE = fs.existsSync(_options.path + '/package.json') ? require(_options.path + '/package.json') : undefined

  _isReady((err) => {
    if (err) {
      console.log(err)
      process.exit()
    } else if (_options.commander) {
      _initCommander()
    }
    cb(err)
  })

  return gitf
}

/**
 * check if the directory have a git repository
 * @param  {Function} cb
 * @return {void}
 */
function _isReady (cb) {
  cb = cb || function () {}

  git.branch((err, resp) => {
    if (err) {
      cb(err)
    } else if (!resp.branches.master) {
      cb(_options.msg.missingMaster)
    } else if (!resp.branches.develop) {
      git.checkoutBranch('develop', 'master', cb)
    } else {
      cb(undefined)
    }
  })
}

/**
 * initialize commander
 * @return {void}
 */
function _initCommander () {
  // console.log('_initCommander')

  let tmpl = _options.tmpl

  for (let name in tmpl) {
    let conf = tmpl[name]

    let inst = program.command(conf.command)

    inst.description(conf.description)

    for (let i = 0; i < conf.options.length; i++) {
      inst.option.apply(inst, conf.options[i])
    }

    if (conf.arguments) {
      inst.arguments(conf.arguments)
    }

    inst.action(gitf.run.bind(this, conf.command))

    let msg = '\n'
    for (let j = 0; j < conf.examples.length; j++) {
      msg += '    ' + conf.examples[j] + '\n'
    }

    inst.on('--help', function () {
      console.log('  Examples:')
      console.log(msg)
    })
  }

  program.on('--help', function () {
    console.log('  Examples:')
    console.log('')
    console.log('    $ custom-help --help')
    console.log('    $ custom-help -h')
    console.log('')
  })

  program.parse(process.argv)
}

/**
 * gitf public API
 * @type {Object}
 */
const gitf = {

  /**
   * run command
   * @param {string} command
   * @return {void}
   */
  run (command) {
    // console.log('run', arguments)

    // define cb
    let cb = arguments[arguments.length - 1]
    if (typeof cb !== 'function') {
      cb = () => {}
    }

    let args = []
    for (var i = 1; i < arguments.length; i++) {
      let arg = arguments[i]
      if (typeof arg === 'string') {
        args.push(arg)
      }
    }

    if (!args.length) {
      args.push('')
    }

    args.push((err) => {
      if (err) {
        console.log('ERROR args:', err)
        cb(err)
        return
      }

      args.pop()

      args.push((str) => {
        // console.log('exec:', str)

        exec(str, { cwd: _options.path }, function (error, stdout, stderr) {
          if (error) {
            console.log('ERROR exec:', error)
            cb(error)
          } else {
          // console.log('complete')
            cb(undefined, stdout)
          }
        })
      })

      _options.tmpl[command].template.apply(this, args)
    })

    _options.tmpl[command].validate.apply(this, args)
  }
}
