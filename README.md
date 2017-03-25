# gitf

> A set of git tools based on [A successful Git branching model](http://nvie.com/posts/a-successful-git-branching-model/)


## Overview

* Start and finish a **feature**, **release** and **hotfix** branch.
* Bump the version number.
* Create a tag for **release** and **hotfix**.
* Remove path from git history.

Good to know
----
* Be sure you have a clean tree before running gitf.
* When started will create the **develop** branch for you if doesn't exist.
* Uses the package.json to manage versions, folowing [Semantic Versioning](http://semver.org/).

Install
----

To install **gitf** globaly run

```bash
npm install gitf -g
```

or to install localy

```bash
npm install gitf --save-dev
```


How it works
----

Use **gitf** in the command line or in node.

### CLI

```bash
gitf --help
```

### Node

Inizialize **gitf** in node:


###### Options

 - `path` string
 - `callback` Function

```js
const gitf = require('gitf')({path: './'}, callback);
```

---

### Create a feature branch

Create a feature branch from develop.

```bash
gitf create-feature experiment
```

###### Options

 - `branchName` string
 - `callback` Function

```js
gitf.run('create-feature' 'experiment', callback)
```

---

### Finish a feature branch

Merge the feature branch in **develop** and delete the feature branch.

```bash
gitf finish-feature experiment
```

###### Options

 - `branchName` string
 - `callback` Function

```js
gitf.run('finish-feature' 'experiment', callback)
```

---

### Create a release branch

Bump version, tag commit and create a release branch from develop.

```bash
gitf create-release minor
```

###### Options

 - `release` string **minor** **major**
 - `callback` Function

```js
gitf.run('create-release' 'minor', callback)
```

---

### Finish a release branch

Bump version and merge the release branch with **develop** and **master**.

```bash
gitf finish-release 0.1
```

###### Options

 - `releaseNumber` string
 - `callback` Function

```js
gitf.run('finish-release' '0.1', callback)
```

---

### Create a hotfix branch

Create a hotfix branch from a **release** branch.

```bash
gitf create-hotfix 0.1
```

###### Options

 - `releaseNumber` string
 - `callback` Function

```js
gitf.run('create-hotfix' '0.1', callback)
```

---

### Finish a hotfix branch

Bump version, tag commit and merge the hotfix branch with **release** and **develop** branch.

```bash
gitf finish-hotfix 0.1.1
```

###### Options

 - `hotfixNumber` string
 - `callback` Function

```js
gitf.run('finish-hotfix' '0.1.1', callback)
```

---

### Remove a path from git history

Remove a path from git history for a specific branch.

```bash
gitf remove-path path/to/remove master
```

###### Options

 - `path` string
 - `branchName` string
 - `callback` Function

```js
gitf.run('remove-path' 'path/to/remove', 'master', callback)
```

What happen behind?
----

#### Create a feature branch

```bash
git checkout -b feature-* develop
```

#### Finish a feature branch

```bash
git checkout develop
git merge feature-*
git branch -d feature-*
```

#### Create a release branch

```bash
git checkout develop
git commit -a -m "bumped version number to release-*.*.*-rc.1"
git tag release-*.*.*-rc.1
git checkout -b release-*.* develop
```

> Bump version number in package.json after checkout develop

#### Finish a release branch

```bash
git checkout develop
git merge release-*.*
git checkout master
git merge release-*.*
```

#### Create a hotfix branch

```bash
git checkout -b hotfix-*.*.* release-*.*
```

#### Finish a hotfix branch

```bash
git commit -a -m "bumped version number to *.*.*"
git tag *.*.*
git checkout release-*
git merge hotfix-*
git checkout develop
git merge hotfix-*
git branch -d hotfix-*
```

#### Remove a path from git history

```bash
git checkout *
git filter-branch --tree-filter 'rm -rf *' --prune-empty HEAD &&
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d &&
git gc
```

Contributing
----

**Test**

The unit test are written in Mocha.
Please add a unit test for every new feature or bug fix. ```npm test``` will run the tests.

**Documentation**

Please add documentation for every API change.

Feel free to contribute!

License
----

Copyright (c) 2017 Bruno Santos Licensed under the MIT license.
