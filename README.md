# smooth-release
Smart CLI utility to **safely** and **automatically** do every step to release a new version of a library hosted on `GitHub` and published on `npm`.

## Install
`npm i -g smooth-release`

## Usage
Simply run `smooth-release` from your root folder, that's all :)

#### Custom settings
- Every config value used by `smooth-release` is overridable: jump to [`.smooth-releaserc`](https://github.com/FrancescoCioria/smooth-release#smooth-releaserc) section to know more about it.
- You can run or turn off specific tasks also by passing a set of CLI arguments: jump to [`CLI arguments`](https://github.com/FrancescoCioria/smooth-release#cli-arguments) section to know more about it.


## What it does
`smooth-release` does five main activities in this order:

1. Run validations
2. Increase version and push new commit and tag
3. Generate CHANGELOG.md
4. Create release on GitHub with link to relative section in CHANGELOG.md
5. Publish on `npm`

### Run validations
In order to proceed each one of these validations must pass (they can be optionally turned off):

1. Current branch must be the one defined in `.smooth-releaserc` (default: "master")
2. Local branch must be in sync with remote
3. No uncommited changes in the working tree
4. No untracked filed in the working tree

### Increase version and push new commit and tag


#### Check if version should be considered "breaking" or not
`smooth-release` automatically detects if the next version should be "breaking" or not.
If a version is "breaking" it will be a `major` otherwise it wil be a `patch`.
`smooth-release` never creates a `minor` version.

To decide if a version is "breaking", `smooth-release` analyzes every closed issue from GitHub: if there is **at least** one *valid* closed issue marked as "breaking" the version will be breaking.

To mark an issue as "breaking" you can add to it a label named as you like. This label should also be added to `smooth-releaserc` to let `smooth-release` know about it.

**MANUAL OVERRIDE:**
If you need to, you can override this step by manually passing the desired version/increase level as argument to `smooth-release`:

```
smooth-release minor
smooth-release pre-major
smooth-release 5.4.6
```

#### npm version and push
Runs in order:

1. `npm version ${newVersion}`
3. `git push`
4. `git push --tags` (never forget to push tags again!)

### Generate CHANGELOG.md
The script to generate the changelog is basically a replic in JavaScript of [github-changelog-generator](https://github.com/skywinder/github-changelog-generator). The only difference is that it only uses closed isses (PRs are ignored).

This script is stateless: every time it's run it replaces CHANGELOG.md with a new one.

**If** the newly generated changelog is different from any previous one it automatically pushes a commit "Update CHANGELOG.md" on origin.

You can see an example by looking at CHANGELOG.md file on this repo: https://github.com/FrancescoCioria/smooth-release/blob/master/CHANGELOG.md.

### Create release on GitHub with link to CHANGELOG.md section
It statelessly creates a GitHub release for the last npm-version tag.

`smooth-release` defines an *npm-version tag* as a tag named `v1.2.3` where 1, 2, 3 can be any number.

The release is named as the tag (ex: v1.2.3) and the body contains a link to the relative section in CHANGELOG.md.

You can see an example by looking at any release on this repo: https://github.com/FrancescoCioria/smooth-release/releases.

### Publish on `npm`
Simply runs:
```bash
npm publish
```

## `.smooth-releaserc`
`smooth-release` comes with a safe default for each config value. This is the `defaultConfig` JSON used by `smooth-release`:

```js
{
  github: {
    changelog: {
      outputPath: './CHANGELOG.md',
      ignoredLabels: ['DX', 'invalid', 'discussion'],
      bug: {
        title: '#### Fixes (bugs & defects):',
        labels: ['bug', 'defect']
      },
      breaking: {
        title: '#### Breaking:',
        labels: ['breaking']
      },
      feature: {
        title: '#### New features:'
      }
    }
  },
  publish: {
    branch: 'master',
    inSyncWithRemote: true,
    noUncommittedChanges: true,
    noUntrackedFiles: true
  },
  tasks: {
    validations: true,
    'npm-publish': null,
    'npm-version': null,
    'gh-release': null,
    'gh-release-all': false,
    changelog: null
  }
}
```

setting a task to `null` means that `smooth-release` will prompt you every time before running the task:
![image](https://cloud.githubusercontent.com/assets/4029499/21606902/e78f23d0-d1b2-11e6-9c17-b4bccf853856.png)

If you want to change parts of the default config you can define a JSON file in the root directory of your project named `.smooth-releaserc`.

The file will be recursively merged into `defaultConfig` (NB: arrays are replaced, not merged!).


## CLI arguments
`smooth-release` can be configured using CLI arguments as well.

The main argument is passed directly to the `npm-version` task so you can use `smooth-release` like `npm version`:
```bash
smooth-release minor
```

You can also override the default behavior of each task by passing it as argument:

Examples
```bash
smooth-release --no-npm-publish # safely run "smooth-release" without publishing on "npm"
smooth-release --changelog --gh-release-all # first time using smooth-release on your repo? this way you add a CHANGELOG.md and a GitHub release for every npm verison tag :)
```

**NOTE:** if you explicitly pass a positive argument (like `--changelog`) `smooth-release` assumes you want to run **only** that task and turns off the other ones. So positive arguments are treated as a whitelist while negative arguments (like `--no-changelog`) are treated as a blacklist.
