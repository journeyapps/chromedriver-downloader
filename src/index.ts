import * as spawn from 'cross-spawn';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as chromeFinder from 'chrome-launcher/dist/chrome-finder';
import * as unzipper from 'unzipper';
import findCacheDirectory from 'find-cache-dir';

type SupportedPlatforms = 'darwin' | 'linux' | 'win32';

const streamPipeline = promisify(pipeline);

(global as any).jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

export interface Options {
  /**
   * Specify to use a specific version of ChromeDriver, instead of auto-detecting.
   */
  chromeDriverVersion?: string;

  /**
   * Specify to use a specific version of Chrome, instead of auto-detecting.
   */
  chromeVersion?: string;

  /**
   * Specify to use a specific path to Chrome, instead of auto-detecting.
   */
  chromeBinary?: string;
}

/**
 * Download and cache ChromeDriver, if it isn't cached yet.
 *
 * @param options Use specific versions instead of auto-detecting.
 */
export async function downloadChromeDriver(options: Options = {}) {
  console.log('Downloading ChromeDriver...');
  const chromeDriverDetails = await getChromeDriverDetails(options);
  console.log('chromeDriverDetails', chromeDriverDetails);
  const chromeDriverPath = await getChromeDriver(chromeDriverDetails.chromeDriverVersion);
  console.log('chromeDriverPath', chromeDriverPath);

  return {
    chromeDriverPath,
    ...chromeDriverDetails,
  };
}

/**
 * Detect the version of ChromeDriver to use.
 */
export async function getChromeDriverDetails(
  options: Options = {},
): Promise<{ chromeDriverVersion: string; chromeVersion?: string; chromeBinary?: string }> {
  if (options.chromeDriverVersion) {
    return {
      chromeDriverVersion: options.chromeDriverVersion,
    };
  }

  let chromeDetails: {
    chromeVersion: string;
    chromeBinary?: string;
  };

  if (options.chromeVersion) {
    chromeDetails = {
      chromeVersion: options.chromeVersion,
    };
  } else {
    chromeDetails = await getChromeDetails(options);
  }

  const url = `https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${chromeDetails.chromeVersion}`;
  console.log('URL:', url);

  const chromeDriverVersion = await fetchText(url);
  console.log('chromeDriverVersion', chromeDriverVersion);

  return {
    chromeDriverVersion,
    ...chromeDetails,
  };
}

/**
 * Get major.minor.patch version of chrome.
 */
export async function getChromeDetails(options: Pick<Options, 'chromeBinary'> = {}) {
  const path = await getChromePath(options);
  let versionString: string;
  if (process.platform == 'win32') {
    const vi = require('win-version-info');
    const info = vi(path);
    versionString = info.FileVersion;
  } else {
    versionString = spawn.sync(path, ['--version']).stdout.toString();
  }
  const versionMatch = versionString.match(/(\d+\.\d+\.\d+)\.\d+/);
  if (versionMatch == null) {
    throw new Error(`Unable to parse version from ${JSON.stringify(versionString)}`);
  }

  console.log('Version:', versionString);

  return {
    chromeVersion: versionMatch[1],
    chromeBinary: path,
  };
}

async function getChromeDriver(chromeDriverVersion: string): Promise<string> {
  const cacheName = require('../package.json').name;
  const cachePath = findCacheDirectory({ name: cacheName, create: true });

  if (cachePath == null) {
    throw new Error('Could not find a cache path');
  }

  const driverPlatform = getDriverPlatform();

  console.log(`getChromeDriver: Using cache path: ${cachePath}`);
  console.log(
    `getChromeDriver: Downloading chromedriver version ${chromeDriverVersion} for platform ${driverPlatform}`,
  );

  const dest: string = path.join(cachePath, `chromedriver_${chromeDriverVersion}`);
  let driverPath: string = path.join(dest, driverPlatform, 'chromedriver');

  console.log('getChromeDriver: Checking for existing chromedriver at:', driverPath);

  if (process.platform == 'win32') {
    driverPath += '.exe';
  }

  if (fs.existsSync(driverPath)) {
    console.log('getChromeDriver: Driver found in cache, skipping download.');

    return driverPath;
  }

  const url = `https://storage.googleapis.com/chrome-for-testing-public/${chromeDriverVersion}/${getDriverPlatformDir()}/${driverPlatform}.zip`;
  await downloadAndUnzip(url, dest);
  fs.chmodSync(driverPath, '770');
  return driverPath;
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return await response.text();
}

async function downloadAndUnzip(url: string, dest: string) {
  console.log(`downloadAndUnzip: Downloading from ${url} to ${dest}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.statusText);
  }

  if (!response.body) {
    throw new Error('Response has no body');
  }

  console.log(`Extracting to ${dest}...`);
  const stream = unzipper.Extract({ path: dest });
  await streamPipeline(response.body, stream);
}

function getDriverPlatformDir() {
  if (process.platform == 'linux') {
    return 'linux64';
  }

  if (process.platform == 'darwin') {
    return 'mac-x64';
  }

  if (process.platform == 'win32') {
    return 'win32';
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

function getDriverPlatform() {
  if (process.platform == 'linux') {
    return 'chrome-linux64';
  }

  if (process.platform == 'darwin') {
    return 'chromedriver-mac-x64';
  }

  if (process.platform == 'win32') {
    return 'chromedriver-win32';
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

export async function getChromePath(options: Pick<Options, 'chromeBinary'> = {}): Promise<string> {
  if (options.chromeBinary) {
    return options.chromeBinary;
  }

  const paths: string[] = chromeFinder[process.platform as SupportedPlatforms]();

  if (paths.length == 0) {
    throw new Error('No chrome installation found');
  }

  console.log('getChromePath: Found chrome installations at:');
  for (const p of paths) {
    console.log(` - ${p}`);
  }

  return paths[0];
}
