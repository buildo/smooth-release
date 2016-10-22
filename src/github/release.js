import { find } from 'lodash';
import { github, log } from '../utils';

export default async (packageJsonVersion) => {
  const tags = await github.tags.fetch();
  const tag = find(tags.data, { name: `v${packageJsonVersion}` });

  if (tag) {
    const commit = await github.commits(tag.commit.sha).fetch();
    const changelogUrl = 'https://github.com/buildo/react-components/blob/master/CHANGELOG.md';
    const tagISODate = commit.data.commit.author.date.slice(0, 10);
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
      if (e.data.message === 'Validation Failed') {
        log(`Release "${tag.name}" already exists`);
      } else {
        throw new Error(e.data.message);
      }
    }
  } else {
    console.log('NO VERSION TAG... Aborting release');
  }

};
