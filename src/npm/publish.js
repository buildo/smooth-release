import { execSync } from 'child_process';
import semver from 'semver';
import { find, sortBy, range } from 'lodash';
import {
  github,
  getCurrentBranch,
  isVersionTag,
  getPackageJsonVersion,
  info,
  title,
  log,
  CustomError,
  status,
  rl
} from '../utils';
import config from '../config';

const stdio = [process.stdin, null, process.stderr];

const runValidations = () => {
  const shouldRunValidations = config.publish.branch && config.publish.inSyncWithRemote;

  if (shouldRunValidations) {
    info('Run validations');
    status.addSteps([
      config.publish.branch && 'Validate branch',
      config.publish.inSyncWithRemote && 'Validate sync with remote'
    ].filter(x => x));

    // ENFORCE BRANCH
    if (config.publish.branch !== null) {
      if (getCurrentBranch() !== config.publish.branch) {
        status.doneStep(false);
        throw new CustomError(`You must be on "${config.publish.branch}" branch to perform this task. Aborting.`);
      }
      status.doneStep(true);
    }

    // ENFORCE SYNC WITH REMOTE
    if (config.publish.inSyncWithRemote) {
      execSync('git fetch');

      const LOCAL = execSync('git rev-parse @', { encoding: 'utf8' }).trim();
      const REMOTE = execSync('git rev-parse @{u}', { encoding: 'utf8' }).trim();
      const BASE = execSync('git merge-base @ @{u}', { encoding: 'utf8' }).trim();

      if (LOCAL !== REMOTE && LOCAL === BASE) {
        status.doneStep(false);
        throw new CustomError('Your local branch is out-of-date. Please pull the latest remote changes. Aborting.');
      } else if (LOCAL !== REMOTE && REMOTE === BASE) {
        status.doneStep(false);
        throw new CustomError('Your local branch is ahead of its remote branch. Please push your local changes. Aborting.');
      } else if (LOCAL !== REMOTE) {
        status.doneStep(false);
        throw new CustomError('Your local and remote branches have diverged. Please put them in sync. Aborting.');
      }
      status.doneStep(true);
    }
  }
};

const computeRelease = async (packageJsonVersion) => {
  info('\nCompute release');
  status.addSteps([
    'Get all tags from GitHub',
    'Check if version should be "breaking"',
    'Compute version'
  ]);

  // AVOID DUPLICATE PUBLISHED VERSIONS
  const tags = await github.tags.fetch();
  status.doneStep(true);

  let breakingIssuesUpdatedAfterLastTag = undefined;
  let lastVersionTagDateTime = undefined;
  const lastVersionTag = find(tags, isVersionTag);

  if (lastVersionTag) {
    const lastVersionTagSha = lastVersionTag.commit.sha;

    const tagCommit = await github.commits(lastVersionTagSha).fetch();
    lastVersionTagDateTime = tagCommit.commit.author.date;

    const issuesUpdatedAfterLastTag = await github.issues.fetch({ state: 'closed', since: lastVersionTagDateTime });
    const unpublishedIssues = issuesUpdatedAfterLastTag.filter(i => i.closedAt >= new Date(lastVersionTagDateTime));

    if (unpublishedIssues.length === 0) {
      throw new CustomError('Can\'t find any issue closed after last publish. Are you sure there are new features to publish?');
    }
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed', since: lastVersionTagDateTime });
  } else {
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed' });
  }

  // VERIFY IF RELEASE SHOULD BE BREAKING
  const unpublishedBreakingIssues = breakingIssuesUpdatedAfterLastTag.filter(i => !lastVersionTagDateTime || i.closedAt >= new Date(lastVersionTagDateTime));
  const isBreaking = unpublishedBreakingIssues.length > 0;
  status.doneStep(true);

  // COMPUTE RELEASE INFO
  const isBeta = semver.satisfies(packageJsonVersion, '< 1');
  const level = isBeta ?
    (isBreaking ? 'minor' : 'patch') :
    (isBreaking ? 'major' : 'patch');
  const version = semver.inc(packageJsonVersion, level);
  status.doneStep(true);

  return {
    isBeta,
    isBreaking,
    level,
    version
  };
};

const confirmation = async releaseInfo => {
  info('\nRelease Info\n');

  const keys = Object.keys(releaseInfo);
  const longestKey = sortBy(keys, key => key.length)[keys.length - 1];

  keys.forEach((key, i) => {
    const emptySpaces = range(longestKey.length - key.length + 1).map(() => ' ').join('');
    const emptyLine = i === keys.length - 1 ? '\n' : '';

    log(`  ${key}:${emptySpaces}${releaseInfo[key]}${emptyLine}`);
  });

  if (!(await rl.confirmation('If you continue you will publish this version to "npm". Are you sure?'))) {
    throw new CustomError('You refused the computed release. Aborting');
  }
};

const publish = (releaseInfo) => {
  info('\nIncrease version and publish package on npm');
  status.addSteps([
    'Run "npm preversion" and "npm version"',
    'Run "npm prepublish" and "npm publish"',
    'Push changes and tags on GitHub'
  ]);

  // START PUBLISH PROCESS
  execSync(`npm version v${releaseInfo.version}`, { stdio });
  status.doneStep(true);

  execSync('npm publish', { stdio });
  status.doneStep(true);

  execSync('git push', { stdio });
  execSync('git push --tags', { stdio });
  status.doneStep(true);
};

export default async () => {
  title('Increase version and publish package on npm');

  runValidations();

  const releaseInfo = await computeRelease(getPackageJsonVersion());

  await confirmation(releaseInfo);

  publish(releaseInfo);

  status.stop();
};
