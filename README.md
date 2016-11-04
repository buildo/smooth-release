# smooth-release
Smart CLI utility to **safeley** and **automatically** do every step to release a new version of a library hosted on `GitHub` and published on `npm`.

## Install
`npm i -g smooth-release`

## Usage
Run `smooth-release` from your root folder

## What it does
`smooth-release` does three thing main activities:

1. Safely increase version and publish on `npm`
2. Generate CHANGELOG.md
3. Create release on GitHub with link to CHANGELOG.md section

### Safely increase version and publish on `npm`
It's composed of three sub steps

#### Run validations
In order to proceed each one of these validations must pass (they can be optionally turned off):

1. Current branch must be the one defined in the config.json (default: "master")
2. Git work directory must be in sync with remote
3. There must be at least one new closed issue on GitHub after last npm-version tag

#### Check if version should breaking or not
`smooth-release` automatically detects if the next version should be breaking or not.
If a version is "breaking" it will be a `major` otherwise it wil be a `patch`.
`smooth-release` never creates a `minor` version.

To decide if a version should be breaking or not `smooth-release` analyzes every closed issue from GitHub: if there is **at least** one *valid* closed issue marked as "breaking" the version will be breaking.
To mark an issue as "breaking" you can add to it a label named as you like. This label should also be added to the config.json to let `smooth-release` know about it.

#### npm version, npm publish and push
Run in order:

1. `npm version ${newVersion}`
2. `npm publish`
3. `git push` e `git push --tags` (never forget to push tags again!)

### Generate CHANGELOG.md
The script to generate the changelog is basically a replic in JavaScript of [github-changelog-generator](https://github.com/skywinder/github-changelog-generator). The only difference is that it only uses closed isses (PRs are ignored).

This script is stateless: every time it's run it replaces CHANGELOG.md with a new one.

**If** the newly generated changelog is different from any previous one it automatically pushes a commit "Update CHANGELOG.md" on origin.

You can see an example by looking at CHANGELOG.md file on this repo: https://github.com/FrancescoCioria/smooth-release/blob/master/CHANGELOG.md.

### Create release on GitHub with link to CHANGELOG.md section
It statelessly creates a GitHub release for the last npm-version tag.

`smooth-release` defines an *npm-version tag* as a tag named `v1.2.3` where 1, 2, 3 can be any number.

The release is names as the tag (ex: v1.2.3) and the body has a link to the correct section in CHANGELOG.md

You can see an example by looking at any release on this repo: https://github.com/FrancescoCioria/smooth-release/releases.

## `.smooth-releaserc`
Each project **must** have a JSON config file in its root folder name `.smooth-releaserc`.

The file should be structured as follows:
```js
{
  "github": {
    "changelog": {
      "ignoredLabels": ["invalid", "DX", "..."],
      "bug": {
        "title": "#### Fixes (bugs & defects):", // (or whatever you choose)
        "labels": ["bug", "defect", "..."]
      },
      "breaking": {
        "title": "#### Breaking:", // (or whatever you choose)
        "labels": ["breaking", "..."]
      },
      "feature": {
        "title": "#### New features:" // (or whatever you choose)
      }
    }
  },
  "publish": {
    "branch": "master", // default: "master"; set to "false" to turn off validation
    "inSyncWithRemote": true // set to "false" to turn off validation
  }
}
```
