import { find } from 'lodash';
import { github, getGithubOwnerAndRepo, log, error } from '../utils';
import getAllTags from '../modules/getAllTags';

export default async (packageJsonVersion) => {
  const tags = await getAllTags();
  const tag = find(tags, { name: `v${packageJsonVersion}` });

  if (tag) {
    const commit = await github.commits(tag.commit.sha).fetch();
    const { owner, repo } = getGithubOwnerAndRepo();
    const changelogUrl = `https://github.com/${owner}/${repo}/blob/master/CHANGELOG.md`;
    const tagISODate = commit.commit.author.date.slice(0, 10);
    const linkToChangelog = `${changelogUrl}#${tag.name.split('.').join('')}-${tagISODate}`;

    const release = {
      tag_name: tag.name,
      name: tag.name,
      body: `See [CHANGELOG.md](${linkToChangelog}) for details about this release.`
    };

    try {
      await github.releases.create(release);
      log(`\nSuccessfully created release "${tag.name}"\n`);
    } catch (e) {
      if (JSON.parse(e.message).message === 'Validation Failed') {
        log(`Release "${tag.name}" already exists`);
      } else {
        throw new Error(e.message);
      }
    }
  } else {
    error('NO VERSION TAG... Aborting release');
  }

};
