import path from 'path';
import fs from 'fs';
import tar from 'tar';
import {
  title, info, log, emptyLine,
  status, exec, rl,
  SmoothReleaseError,
  getRootFolderPath, getPackageJsonName, getPackageJsonVersion
} from '../utils';
import config from '../config';

const stdio = [process.stdin, null, process.stderr];

const tarPackageFilename = `${getPackageJsonName()}-${getPackageJsonVersion()}.tgz`;
const tarPackageFilePath = path.resolve(getRootFolderPath(), tarPackageFilename);

const readTar = (file) => {
  const actual = [];
  const onentry = entry => actual.push(entry.path);
  return tar.list({ file, onentry }).then(() => actual);
};

async function generatePackage() {
  status.addSteps([
    'Run "npm pack"'
  ]);

  // generate tar package
  await exec('npm pack', { stdio });
  status.doneStep(true);
}

function deletePackage() {
  fs.unlinkSync(tarPackageFilePath);
}

async function confirmation() {
  // log package
  info('Package contents');
  const tarContents = await readTar(tarPackageFilePath);
  tarContents.forEach(f => log(`  ${f.replace('package/', '')}`));
  emptyLine();

  if (!await rl.confirmation('If you continue you will publish the package on npm. Are you sure?')) {
    deletePackage();
    throw new SmoothReleaseError('You refused the generated package. Aborting');
  }
}

async function publish() {
  status.addSteps([
    'Run "npm prepublish" and "npm publish"'
  ]);

  await exec(`npm publish ${tarPackageFilename}`, { stdio });
  deletePackage();
  status.doneStep(true);
}

export default async () => {
  title('Publish package on npm');

  await generatePackage();

  if (config.publish.tarPackageConfirmation) {
    await confirmation();
  }

  await publish();
};
