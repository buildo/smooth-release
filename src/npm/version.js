import semver from 'semver';
import { find, sortBy, range } from 'lodash';
import {
  github,
  isVersionTag,
  getPackageJsonVersion,
  info,
  title,
  log,
  emptyLine,
  CustomError,
  status,
  rl,
  exec
} from '../utils';

const stdio = [process.stdin, null, process.stderr];

const computeRelease = async ({ manualVersion, packageJsonVersion }) => {
  info('Compute release');

  if (!manualVersion) {
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
  } else {
    status.addSteps([
      'Compute version'
    ]);

    const version = semver.valid(manualVersion) || semver.inc(packageJsonVersion, manualVersion);

    if (semver.lte(version, packageJsonVersion)) {
      throw new CustomError(`You can't pass a version lower than or equal to "${packageJsonVersion}" (current version)`);
    }

    const isBeta = semver.satisfies(packageJsonVersion, '< 1');
    const level = semver.diff(packageJsonVersion, version);
    const isBreaking = level === 'major';
    status.doneStep(true);

    return {
      isBeta,
      isBreaking,
      level,
      version
    };
  }
};

const confirmation = async releaseInfo => {
  info('Release Info');

  const keys = Object.keys(releaseInfo);
  const longestKey = sortBy(keys, key => key.length)[keys.length - 1];

  keys.forEach((key, i) => {
    const emptySpaces = range(longestKey.length - key.length + 1).map(() => ' ').join('');
    const emptyLine = i === keys.length - 1 ? '\n' : '';

    log(`  ${key}:${emptySpaces}${releaseInfo[key]}${emptyLine}`);
  });

  if (!(await rl.confirmation('If you continue you will update "package.json" and add a tag. Are you sure?'))) {
    throw new CustomError('You refused the computed release. Aborting');
  }

  emptyLine();
};

const version = async (releaseInfo) => {
  info('Increase version');
  status.addSteps([
    'Run "npm preversion" and "npm version"',
    'Push changes and tags to GitHub'
  ]);

  await exec(`npm version v${releaseInfo.version}`, { stdio });
  status.doneStep(true);

  await exec('git push', { stdio });
  await exec('git push --tags', { stdio });
  status.doneStep(true);
};

export default async (manualVersion) => {
  title('Increase version in "package.json"');

  const releaseInfo = await computeRelease({
    manualVersion,
    packageJsonVersion: getPackageJsonVersion()
  });

  await confirmation(releaseInfo);

  await version(releaseInfo);
};
