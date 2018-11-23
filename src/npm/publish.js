import path from 'path';
import fs from 'fs';
import tar from 'tar';
import {
  title, info, log, emptyLine,
  status, exec, rl,
  SmoothReleaseError,
  getRootFolderPath,
  getPackageJsonScripts, getPackageJsonName, getPackageJsonVersion
} from '../utils';
import config from '../config';

const stdio = [process.stdin, null, process.stderr];

const readTar = (file) => {
  const actual = [];
  const onentry = entry => actual.push(entry.path);
  return tar.list({ file, onentry }).then(() => actual);
};

async function prepublish() {
  await exec('npm run prepublish', { stdio });
  status.doneStep(true);
}

async function generatePackage() {
  // generate tar package
  await exec('npm pack', { stdio });
  status.doneStep(true);
}

function deletePackage(tarPackageFilePath) {
  fs.unlinkSync(tarPackageFilePath);
}

async function confirmation(tarPackageFilePath) {
  // log package
  info('Package contents');
  const tarContents = await readTar(tarPackageFilePath);
  tarContents.forEach(f => log(`  ${f.replace('package/', '')}`));
  emptyLine();

  if (!await rl.confirmation('If you continue you will publish the package on npm. Are you sure?')) {
    deletePackage(tarPackageFilePath);
    throw new SmoothReleaseError('You refused the generated package. Aborting');
  }
  emptyLine();
}

async function publish(useTarPackage, tarPackageFilename, tarPackageFilePath) {
  status.addSteps([
    'Run "npm publish"'
  ]);

  if (useTarPackage) {
    await exec(`npm publish ${tarPackageFilename} --registry https://registry.npmjs.org/`, { stdio });
  } else {
    await exec('npm publish --registry https://registry.npmjs.org/', { stdio });
  }

  deletePackage(tarPackageFilePath);
  status.doneStep(true);
}

export default async () => {
  title('Publish package on npm');

  const tarPackageFilename = `${getPackageJsonName()}-${getPackageJsonVersion()}.tgz`;
  const tarPackageFilePath = path.resolve(getRootFolderPath(), tarPackageFilename);

  if (config.publish.tarPackageConfirmation) {
    status.addSteps([
      getPackageJsonScripts().prepublish && 'Run "npm prepublish"',
      'Run "npm pack"'
    ]);

    getPackageJsonScripts().prepublish && await prepublish();
    await generatePackage();
    await confirmation(tarPackageFilePath);
  }

  await publish(config.publish.tarPackageConfirmation, tarPackageFilename, tarPackageFilePath);
};
