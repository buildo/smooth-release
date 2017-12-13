import fs from 'fs';
import { execSync } from 'child_process';
import minimist from 'minimist';
import t from 'tcomb';
import { mergeWith } from 'lodash';
import getToken from './github/token';
import console from 'better-console';

const { token } = minimist(process.argv.slice(2));

t.interface.strict = true;

const getRootFolderPath = () => execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const smoothReleaseRCPath = `${getRootFolderPath()}/.smooth-releaserc`;
const smoothReleaseRC = fs.existsSync(smoothReleaseRCPath) ?
  JSON.parse(fs.readFileSync(smoothReleaseRCPath)) :
  {};

const Config = t.interface({
  github: t.interface({
    token: t.maybe(t.String),
    dataType: t.maybe(t.enums.of(['issues', 'pullRequests'])),
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
    noUntrackedFiles: t.Boolean,
    validNpmCredentials: t.Boolean,
    validGithubToken: t.Boolean,
    packageFilesFilter: t.union([t.enums.of(['npmignore', 'files']), t.Boolean]),
    npmVersionConfirmation: t.Boolean,
    tarPackageConfirmation: t.Boolean
  }),
  tasks: t.interface({
    changelog: t.maybe(t.Boolean),
    validations: t.maybe(t.Boolean),
    'npm-version': t.maybe(t.Boolean),
    'npm-publish': t.maybe(t.Boolean),
    'gh-release': t.maybe(t.Boolean),
    'gh-release-all': t.maybe(t.Boolean)
  })
}, { name: 'SmoothReleaseRC' });

const defaultConfig = {
  github: {
    dataType: 'issues',
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
    noUntrackedFiles: true,
    validNpmCredentials: true,
    validGithubToken: true,
    packageFilesFilter: 'files',
    npmVersionConfirmation: true,
    tarPackageConfirmation: true
  },
  tasks: {
    validations: true,
    'npm-publish': null,
    'npm-version': null,
    'gh-release': null,
    'gh-release-all': false,
    changelog: null
  }
};

const config = mergeWith(
  defaultConfig, smoothReleaseRC, { github: { token: token || getToken() } },
  (a, b) => t.Array.is(a) ? b : undefined
);


let validatedConfig = null;
try {
  validatedConfig = Config(config);
} catch (e) {
  console.error('\n".smooth-releaserc" is invalid.\n');
  console.error(e);
  console.error();
  process.exit(1);
}

export default validatedConfig;
