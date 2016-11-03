import { find } from 'lodash';
import status from 'node-status';
import { github, getGithubOwnerAndRepo, title, info, CustomError } from '../utils';
import getAllTags from '../modules/getAllTags';

const getLastVersionTag = async packageJsonVersion => {
  info('Get last npm version "tag"');
  const statusSteps = status.addItem('lastVersionTag', {
    steps: [
      'Get all tags from GitHub',
      'Find last npm-version tag'
    ]
  });

  const tags = await getAllTags();
  statusSteps.doneStep(true);

  const tag = find(tags, { name: `v${packageJsonVersion}` });
  statusSteps.doneStep(!!tag);

  return tag || null;
};

const computeRelease = async tag => {
  info('\nCompute release');
  const statusSteps = status.addItem('release', {
    steps: [
      'Get tag\'s creation datetime from GitHub',
      'Compute "release" object'
    ]
  });

  const commit = await github.commits(tag.commit.sha).fetch();
  const { owner, repo } = getGithubOwnerAndRepo();
  const changelogUrl = `https://github.com/${owner}/${repo}/blob/master/CHANGELOG.md`;
  const tagISODate = commit.commit.author.date.slice(0, 10);
  statusSteps.doneStep(true);

  const linkToChangelog = `${changelogUrl}#${tag.name.split('.').join('')}-${tagISODate}`;
  const release = {
    tag_name: tag.name,
    name: tag.name,
    body: `See [CHANGELOG.md](${linkToChangelog}) for details about this release.`
  };
  statusSteps.doneStep(true);

  return release;
};

const postRelease = async release => {
  info('\nCreate new release on GitHub');
  const statusSteps = status.addItem('postRelease', {
    steps: [
      'Post release on GitHub'
    ]
  });

  try {
    await github.releases.create(release);
    statusSteps.doneStep(true);
  } catch (e) {
    const { message } = JSON.parse(e.message);
    statusSteps.doneStep(false);
    throw new CustomError(message === 'Validation Failed' ? `Release "${release.tag_name}" already exists` : message);
  }
};

export default async (packageJsonVersion) => {
  title('\nPost release on GitHub for latest npm-version tag');
  status.start({ pattern: '{spinner.cyan}' });

  const tag = await getLastVersionTag(packageJsonVersion);

  if (tag) {
    const release = await computeRelease(tag);

    await postRelease(release);
  }

  status.stop();
};
