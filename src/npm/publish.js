import { title, status, exec } from '../utils';

const stdio = [process.stdin, null, process.stderr];

export default async () => {
  title('Publish package on npm');

  status.addSteps([
    'Run "npm prepublish" and "npm publish"'
  ]);

  await exec('npm publish', { stdio });
  status.doneStep(true);
};
