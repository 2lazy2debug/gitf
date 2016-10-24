#! /usr/bin/env node

'use strict';

var inquirer = require('inquirer');
var simpleGit = require('simple-git');
var semver = require('semver');
var mustache = require('mustache');
var exec = require('child_process').exec;

var msg = {
  empty: 'nothing to do, press ENTER to continue...'
};
var path = process.cwd();
var pkg = require(path + '/package.json');
var tmpl = {

  'create-feature': '' +
    'echo Creating a feature branch && ' +
    'git checkout -b feature-{{name}} develop',

  'incorporate-feature': '' +
    'echo Incorporating a finished feature on develop && ' +
    'git checkout develop && ' +
    'git merge --no-ff {{name}} && ' +
    'git branch -d {{name}} && ' +
    'git push origin develop',

  'create-release': '' +
    'echo Creating a release branch for {{nextReleaseVersion}} && ' +
    'git checkout -b release-{{nextReleaseVersion}} develop && ' +
    "sed -i '' -e 's/\"version\": \"{{currentVersion}}/\"version\": \"{{nextReleaseVersion}}.0/g' package.json && " +
    'git commit -a -m "bumped version number to {{nextReleaseVersion}}.0" &&' +
    'git push -u origin release-{{nextReleaseVersion}}',

  'finish-release': '' +
    'echo Finishing a release branch for {{name}} && ' +
    'git checkout master && ' +
    'git merge --no-ff {{name}} && ' +
    'git tag v{{currentVersion}} && ' +
    'git checkout develop && ' +
    'git merge --no-ff {{name}}',

  'create-hotfix': '' +
    'echo Creating the {{patchVersion}} hotfix branch && ' +
    'git checkout -b hotfix-{{patchVersion}} {{name}} && ' +
    "sed -i '' -e 's/\"version\": \"{{currentVersion}}/\"version\": \"{{patchVersion}}/g' package.json && " +
    'git commit -a -m "bumped version number to {{patchVersion}}"',

  'finish-hotfix': '' +
    'echo Finishing a hotfix branch && ' +
    'git checkout release-{{currentReleaseVersion}} && ' +
    'git merge --no-ff {{name}} && ' +
    'git tag v{{currentVersion}} && ' +
    'git checkout develop && ' +
    'git merge --no-ff {{name}} && ' +
    'git branch -d {{name}}'
};

console.log('Welcome to gitf, current version is ' + pkg.version);

/**
 * start
 * @return {void}
 */
function start(branch) {
  //console.log('start', branch);

  // clean console
  process.stdout.write('\u001b[2J\u001b[0;0H');

  var questions = [{
    type: 'list',
    name: 'action',
    message: 'Select a action...',
    choices: [{
      value: 'create-feature',
      name: 'Create a feature branch'
    }, {
      value: 'incorporate-feature',
      name: 'Finish a feature branch'
    }, {
      value: 'create-release',
      name: 'Create a release branch'
    }, {
      value: 'finish-release',
      name: 'Finish a release branch'
    }, {
      value: 'create-hotfix',
      name: 'Create a hotfix branch'
    }, {
      value: 'finish-hotfix',
      name: 'Finish a hotfix branch'
    }]
  }, {
    name: 'value',
    type: 'input',
    message: 'Name for the feature branch:',
    when: function(answers) {
      return answers.action === 'create-feature';
    }
  }, {
    name: 'value',
    type: 'list',
    message: 'Select a feature branch to finish',
    default: branch.feature[0],
    choices: branch.feature,
    when: function(answers) {
      return answers.action === 'incorporate-feature';
    }
  }, {
    name: 'value',
    type: 'list',
    message: 'Select the type of the release',
    default: 'minor',
    choices: ['minor', 'major'],
    when: function(answers) {
      return answers.action === 'create-release';
    }
  }, {
    name: 'value',
    type: 'list',
    message: 'Select a release branch to finish',
    default: branch.unfinishedRelease[0],
    choices: branch.unfinishedRelease,
    when: function(answers) {
      return answers.action === 'finish-release';
    }
  }, {
    name: 'value',
    type: 'list',
    message: 'Select a release branch to hotfix',
    default: branch.release[0],
    choices: branch.release,
    when: function(answers) {
      return answers.action === 'create-hotfix';
    }
  }, {
    name: 'value',
    type: 'list',
    message: 'Select a hotfix branch to finish',
    default: branch.hotfix[0],
    choices: branch.hotfix,
    when: function(answers) {
      return answers.action === 'finish-hotfix';
    }
  }];

  inquirer.prompt(questions).then(function(result) {
    //console.log('result', result);

    // return if there is nothing to do
    if (result.value === msg.empty) {
      start(branch);
      return;
    }

    // versions
    var version = {
      current: pkg.version,
      major: semver.inc(pkg.version, 'major'),
      minor: semver.inc(pkg.version, 'minor'),
      patch: semver.inc(pkg.version, 'patch'),
      currentRelease: undefined,
      nextRelease: undefined
    };

    var ver;

    // get current release version
    ver = version.current;
    version.currentRelease = ver.substr(0, ver.lastIndexOf('.'));

    // get next release version
    ver = version[result.value] || version.minor;
    version.nextRelease = ver.substr(0, ver.lastIndexOf('.'));

    var str = mustache.render(tmpl[result.action], {
      // value from user input
      name: result.value,

      // current version from package.json
      currentVersion: version.current,

      // next major version
      majorVersion: version.major,

      // next minor version
      minorVersion: version.minor,

      // next patch version
      patchVersion: version.patch,

      // current release version like major.minor
      currentReleaseVersion: version.currentRelease,

      // next release version like major.minor
      nextReleaseVersion: version.nextRelease
    });

    //console.log('exec:', str);
    exec(str, function(error, stdout, stderr) {
      if (error) {
        console.log('ERROR:', error);
      } else {
        console.log(stderr);
      }
    });
  });
}

var git = simpleGit(path + '/');
// get branch list
git.branch(function(err, obj) {
  if (err) {
    console.log('ERROR:', err);
    return;
  }

  // get tags
  git.tags(function(err, tags) {
    if (err) {
      console.log('ERROR:', err);
      return;
    }

    var branch = {
      feature: [],
      release: [],
      unfinishedRelease: [],
      hotfix: [],
      develop: undefined
    };

    /**
     * set branch
     * @param {string} b
     */
    function setBranch(b) {
      if (b.indexOf('feature') !== -1) {
        branch.feature.push(b);
      } else if (b.indexOf('release') !== -1) {
        branch.release.push(b);

        // check if release branch has been merged with master
        var num = b.split('release-')[1];
        if (tags.all.indexOf('v' + num + '.0') === -1) {
          branch.unfinishedRelease.push(b);
        }
      } else if (b.indexOf('hotfix') !== -1) {
        branch.hotfix.push(b);
      } else if (b.indexOf('develop') !== -1) {
        branch.develop = b;
      }
    }

    for (var i = 0, len = obj.all.length; i < len; i++) {
      var b = obj.all[i];

      // bring missing remote branches to locally
      if (b.indexOf('remotes/') !== -1) {
        var bName = b.substr(b.lastIndexOf('/') + 1);
        if (obj.all.indexOf(bName) === -1) {
          // add remote branch locally
          git.checkout(bName, function() {});

          // prevent double check
          obj.all.push(bName);

          setBranch(bName);
        }
        continue;
      }

      setBranch(b);
    }

    // set msg if there is no branch
    // to be displayed when user interact
    if (branch.feature.length === 0) {
      branch.feature.push(msg.empty);
    }
    if (branch.release.length === 0) {
      branch.release.push(msg.empty);
    }
    if (branch.unfinishedRelease.length === 0) {
      branch.unfinishedRelease.push(msg.empty);
    }
    if (branch.hotfix.length === 0) {
      branch.hotfix.push(msg.empty);
    }

    // create branch develop if do not exist
    if (branch.develop === undefined) {
      git.checkoutBranch('develop', 'master', function() {
        git.push(['-u', 'origin', 'develop'], function() {
          branch.develop = 'develop';
          start(branch);
        });
      });
    } else {
      start(branch);
    }

  });

});
