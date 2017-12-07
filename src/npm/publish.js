import path from 'path';
import fs from 'fs';
import {
  title, info, log, emptyLine,
  status, exec, rl,
  SmoothReleaseError,
  getRootFolderPath, getPackageJsonName, getPackageJsonVersion
} from '../utils';
import tar from 'tar';

const stdio = [process.stdin, null, process.stderr];

const readTar = (file) => {
  const actual = [];
  const onentry = entry => actual.push(entry.path);
  return tar.list({ file, onentry }).then(() => actual);
};

export default async () => {
  title('Publish package on npm');

  status.addSteps([
    'Run "npm pack"'
  ]);

  // generate tar package
  await exec('npm pack', { stdio });
  status.doneStep(true);

  // log package
  info('Package contents');
  const tarPackageFilename = `${getPackageJsonName()}-${getPackageJsonVersion()}.tgz`;
  const tarPackageFilePath = path.resolve(getRootFolderPath(), tarPackageFilename);
  const tarContents = await readTar(tarPackageFilePath);
  tarContents.forEach(f => log(`  ${f.replace('package/', '')}`));
  emptyLine();

  if (!await rl.confirmation('If you continue you will publish the package on npm. Are you sure?')) {
    fs.unlinkSync(tarPackageFilePath);
    throw new SmoothReleaseError('You refused the generated package. Aborting');
  }

  status.addSteps([
    'Run "npm prepublish" and "npm publish"'
  ]);

  await exec(`npm publish ${tarPackageFilename}`, { stdio });
  fs.unlinkSync(tarPackageFilePath);
  status.doneStep(true);
};
