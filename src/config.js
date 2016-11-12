import fs from 'fs';
import { execSync } from 'child_process';
import t from 'tcomb';
import { mergeWith } from 'lodash';
import getToken from './github/token';

t.interface.strict = true;

const getRootFolderPath = () => execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const smoothReleaseRCPath = `${getRootFolderPath()}/.smooth-releaserc`;
const smoothReleaseRC = fs.existsSync(smoothReleaseRCPath) ?
  JSON.parse(fs.readFileSync(smoothReleaseRCPath)) :
  {};

const Config = t.interface({
  github: t.interface({
    token: t.maybe(t.String),
    changelog: t.interface({
      outputPath: t.String,
      ignoredLabels: t.list(t.String),
      breaking: t.interface({
        title: t.String,
        labels: t.list(t.String)
      }),
      bug: t.interface({
        title: t.String,
        labels: t.list(t.String)
      }),
      feature: t.interface({
        title: t.String
      })
    })
  }),
  publish: t.interface({
    branch: t.maybe(t.String),
    inSyncWithRemote: t.Boolean,
    noUncommittedChanges: t.Boolean,
    noUntrackedFiles: t.Boolean
  })
});

const defaultConfig = {
  github: {
    changelog: {
      outputPath: './CHANGELOG.md',
      ignoredLabels: ['DX', 'invalid', 'discussion'],
      bug: {
        title: '#### Fixes (bugs & defects):',
        labels: ['bug', 'defect']
      },
      breaking: {
        title: '#### Breaking:',
        labels: ['breaking']
      },
      feature: {
        title: '#### New features:'
      }
    }
  },
  publish: {
    branch: 'master',
    inSyncWithRemote: true,
    noUncommittedChanges: true,
    noUntrackedFiles: true
  }
};

const config = mergeWith(
  defaultConfig, smoothReleaseRC, { github: { token: getToken() } },
  (a, b) => t.Array.is(a) ? b : undefined
);

export default Config(config);
