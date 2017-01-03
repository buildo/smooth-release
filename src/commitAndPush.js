import {
  getRootFolderPath,
  getPackageJsonVersion,
  title,
  status,
  exec
} from './utils';
import config from './config';

const stdio = [process.stdin, null, process.stderr];

export default async ({ hasIncreasedVersion, hasUpdatedChangelog }) => {
  if (!hasIncreasedVersion && !hasUpdatedChangelog) {
    return;
  }

  title('Commit and push changes');

  status.addSteps([
    'Create commit',
    hasIncreasedVersion && 'Add tag',
    'Push changes to GitHub',
    hasIncreasedVersion && 'Push tags to GitHub'
  ]);

  const changelogPath = `${getRootFolderPath()}/${config.github.changelog.outputPath}`;
  const packageJsonPath = `${getRootFolderPath()}/package.json`;
  await exec(`git add ${changelogPath} ${packageJsonPath}`, { stdio });

  const packageJsonVersion = getPackageJsonVersion();
  const commitMessage = hasIncreasedVersion ? packageJsonVersion : 'Update CHANGELOG.md';
  await exec(`git commit -m "${commitMessage}"`, { stdio });
  status.doneStep(true);

  if (hasIncreasedVersion) {
    await exec(`git tag v${packageJsonVersion}`, { stdio });
    status.doneStep(true);
  }

  await exec('git push', { stdio });
  status.doneStep(true);

  if (hasIncreasedVersion) {
    await exec('git push --tags', { stdio });
    status.doneStep(true);
  }

};
