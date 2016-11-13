import { find } from 'lodash';
import stagger from 'staggerjs';
import {
  github,
  getGithubOwnerAndRepo,
  getPackageJsonVersion,
  title,
  info,
  status,
  CustomError,
  isVersionTag
} from '../utils';
import getAllTags from '../modules/getAllTags';

const getAllVersionTags = async () => {
  info('Get all npm version "tags"\n');
  status.addSteps([
    'Get all tags from GitHub',
    'filter npm-version tags'
  ]);

  const tags = await getAllTags();
  status.doneStep(true);

  const versionTags = tags.filter(isVersionTag);
  status.doneStep(versionTags.length > 0);

  return versionTags;
};

const getLastVersionTag = async packageJsonVersion => {
  info('Get last npm version "tag"\n');
  status.addSteps([
    'Get all tags from GitHub',
    'Find last npm-version tag'
  ]);

  const tags = await getAllTags();
  status.doneStep(true);

  const tag = find(tags, { name: `v${packageJsonVersion}` });
  status.doneStep(!!tag);

  return tag || null;
};

const computeRelease = async tag => {
  info('Compute release\n');
  status.addSteps([
    'Get tag\'s creation datetime from GitHub',
    'Compute "release" object'
  ]);

  const commit = await github.commits(tag.commit.sha).fetch();
  const { owner, repo } = getGithubOwnerAndRepo();
  const changelogUrl = `https://github.com/${owner}/${repo}/blob/master/CHANGELOG.md`;
  const tagISODate = commit.commit.author.date.slice(0, 10);
  status.doneStep(true);

  const linkToChangelog = `${changelogUrl}#${tag.name.split('.').join('')}-${tagISODate}`;
  const release = {
    tag_name: tag.name,
    name: tag.name,
    body: `See [CHANGELOG.md](${linkToChangelog}) for details about this release.`
  };
  status.doneStep(true);

  return release;
};

const postRelease = async release => {
  info('Create new release on GitHub\n');
  status.addSteps([
    'Post release on GitHub'
  ]);

  try {
    await github.releases.create(release);
    status.doneStep(true);
  } catch (e) {
    const { message } = JSON.parse(e.message);
    throw new CustomError(message === 'Validation Failed' ? `Release "${release.tag_name}" already exists` : message);
  }
};

export default async ({ all }) => {
  title(`\nPost release on GitHub for ${all ? 'every' : 'latest'} npm-version tag`);

  if (all) {
    const versionTags = await getAllVersionTags();

    await stagger(versionTags.map(tag => async () => {
      const release = await computeRelease(tag);
      await postRelease(release);
    }), { maxOngoingMethods: 1 });

  } else {
    const tag = await getLastVersionTag(getPackageJsonVersion());

    if (tag) {
      const release = await computeRelease(tag);

      await postRelease(release);
    }
  }
};
