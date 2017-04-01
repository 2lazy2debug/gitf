'use strict'

const simpleGit = require('simple-git')
const program = require('commander')
const semver = require('semver')
const exec = require('child_process').exec
const fs = require('fs')

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
  _commander: false,

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
      validate: function (name, cb) {
        if (typeof name === 'string') {
          cb(undefined)
        } else {
          cb('missing name')
        }
      },
      template: function (name, cb) {
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
      validate: function (name, cb) {
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
      template: function (name, cb) {
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
      validate: function (level, cb) {
        cb = cb || level
        cb(undefined)
      },
      template: function (level, cb) {
        level = ['minor', 'major'].indexOf(level) === -1 ? 'minor' : level

        this.getLastVersion((version) => {
          let nextReleaseVersion = semver.inc(version, level)
          let branchName = nextReleaseVersion.substr(0, nextReleaseVersion.lastIndexOf('.'))
          git.checkout('develop', () => {
            this.setPackageVersion(nextReleaseVersion)
            cb(
              `git commit -a -m "bumped version number to ${nextReleaseVersion}-rc.1" &&
              git tag ${nextReleaseVersion}-rc.1 &&
              git checkout -b release-${branchName} develop`
            )
          })
        })
      }
    },

    /**
     * Bump version and merge the release branch with develop.
     */
    'finish-release': {
      command: 'finish-release',
      description: 'Merge a finished release with develop',
      options: [],
      arguments: '<version>',
      examples: [
        '$ gitf finish-release 1.0'
      ],
      validate: function (version, cb) {
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
      template: function (input, cb) {
        this.getLastVersion(input, (version) => {
          let nextReleaseVersion = semver.inc(version, 'patch')
          let branchName = nextReleaseVersion.substr(0, nextReleaseVersion.lastIndexOf('.'))
          git.checkout(`release-${branchName}`, () => {
            this.setPackageVersion(nextReleaseVersion)
            cb(
              `git commit -a -m "bumped version number to ${nextReleaseVersion}" &&
              git tag ${nextReleaseVersion} &&
              git checkout develop &&
              git merge release-${branchName}`
            )
          })
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
      validate: function (release, cb) {
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
      template: function (release, cb) {
        this.getLastVersion(release, (version) => {
          let nextReleaseVersion = semver.inc(version, 'patch')
          cb(`git checkout -b hotfix-${nextReleaseVersion} release-${release}`)
        })
      }
    },

    /**
     * Bump version, tag commit
     * and merge the hotfix branch with release branch.
     */
    'finish-hotfix': {
      command: 'finish-hotfix',
      description: 'Merge a finished hotfix with release and develop',
      options: [],
      arguments: '<version>',
      examples: [
        '$ gitf finish-hotfix 1.0.1'
      ],
      validate: function (version, cb) {
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
      template: function (version, cb) {
        let branchName = version.substr(0, version.lastIndexOf('.'))
        git.checkout(`hotfix-${version}`, () => {
          this.setPackageVersion(version)
          cb(
              `git commit -a -m "bumped version number to ${version}" &&
              git tag ${version} &&
              git checkout release-${branchName} &&
              git merge hotfix-${version} &&
              git branch -d hotfix-${version}`
            )
        })
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
      validate: function (path, branch, cb) {
        if (typeof path === 'string' && typeof branch === 'string') {
          cb(undefined)
        } else {
          cb('missing path or branch')
        }
      },
      template: function (path, branch, cb) {
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
module.exports = class {

  /**
   * constructor
   * @param  {Object}   options
   * @param  {Function} cb
   * @return {Object}
   */
  constructor (options, cb) {
    cb = cb || function () {}

    Object.assign(_options, options)

    if (_options.clearScreen) {
      process.stdout.write('\u001b[2J\u001b[0;0H')
    }

    git = simpleGit(_options.path)

    _isReady((err) => {
      if (err) {
        console.log(err)
        process.exit()
      } else if (_options._commander) {
        _initCommander.bind(this)()
      }
      cb(err)
    })

    return this
  }

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

  /**
   * get version from package.json
   * @return {string}
   */
  getPackageVersion () {
    let path = _options.path + '/package.json'
    let PACKAGE = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : undefined
    return PACKAGE.version
  }

  /**
   * set version in package.json
   * @param {string} version
   * @return {void}
   */
  setPackageVersion (version) {
    let path = _options.path + '/package.json'
    let PACKAGE = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : undefined
    PACKAGE.version = version
    fs.writeFileSync(path, JSON.stringify(PACKAGE, null, 4))
  }

  /**
   * get last version
   * @param  {string|undefined}   release
   * @param  {Function}           cb
   * @return {void}
   */
  getLastVersion (release, cb) {
    let path = _options.path + '/package.json'

    if (!cb) {
      cb = release
      release = undefined
    }

    git.tags((err, resp) => {
      if (err) {
        cb()
      } else {
        // get last version
        let lastVersion
        for (let i = 0; i < resp.all.length; i++) {
          let version = resp.all[i]

          if (version.indexOf('-rc') !== -1) {
            version = version.substring(0, version.lastIndexOf('-'))
          }

          if (release && version.substring(0, version.lastIndexOf('.')) !== release) {
            continue
          }

          lastVersion = lastVersion || version

          if (semver.valid(version) && semver.valid(lastVersion) && semver.gt(version, lastVersion)) {
            lastVersion = version
          }
        }

        if (!release && !lastVersion) {
          lastVersion = this.getPackageVersion(path)
        }

        cb(lastVersion)
      }
    })
  }

  /**
   * check if version is merged with branch
   * @param  {string}   version
   * @param  {string|undefined}   branch
   * @param  {Function} cb
   * @return {void}
   */
  isMerged (version, branch, cb) {
    if (!cb) {
      cb = branch
      branch = 'develop'
    }

    exec('git branch --merged ' + branch, function (error, stdout, stderr) {
      if (error) {
        cb(false)
      } else if (stdout.indexOf('release-' + version) !== -1) {
        cb(true)
      } else {
        cb(false)
      }
    })
  }

}

/**
 * check if the directory have a git repository
 * @private
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
 * @private
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

    inst.action(this.run.bind(this, conf.command))

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
