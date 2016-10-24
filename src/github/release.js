import { find } from 'lodash';
import status from 'node-status';
import { github, getGithubOwnerAndRepo, info } from '../utils';
import getAllTags from '../modules/getAllTags';

const statusSteps = status.addItem('release', {
  steps: [
    'Get all tags from GitHub',
    'Get last npm-version tag',
    'Get tag\'s creation datetime from GitHub',
    'Post release on GitHub'
  ]
});

export default async (packageJsonVersion) => {
  info('Post release on GitHub for latest npm-version tag');
  status.start({ pattern: '{spinner.cyan}' });

  const tags = await getAllTags();
  statusSteps.doneStep(true);

  const tag = find(tags, { name: `v${packageJsonVersion}` });

  if (tag) {
    statusSteps.doneStep(true);
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

    try {
      await github.releases.create(release);
      statusSteps.doneStep(true);
    } catch (e) {
      const { message } = JSON.parse(e.message);
      statusSteps.doneStep(false);
      status.stop();
      throw new Error(message === 'Validation Failed' ? `Release "${tag.name}" already exists` : message);
    }
  } else {
    statusSteps.doneStep(false);
  }

  status.stop();
};
