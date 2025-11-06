import * as spawn from 'cross-spawn';
import * as fs from 'fs';
import * as unzipper from 'unzipper';
import * as path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as chromeFinder from 'chrome-launcher/dist/chrome-finder';
import findCacheDirectory from 'find-cache-dir';

type SupportedPlatforms = 'darwin' | 'linux' | 'win32';

const streamPipeline = promisify(pipeline);

(global as any).jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

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
  const chromeDriverDetails = await getChromeDriverDetails(options);
  const chromeDriverPath = await getChromeDriver(chromeDriverDetails.chromeDriverVersion);

  return {
    chromeDriverPath,
    ...chromeDriverDetails
  };
}

/**
 * Detect the version of ChromeDriver to use.
 */
export async function getChromeDriverDetails(
  options: Options = {}
): Promise<{ chromeDriverVersion: string; chromeVersion?: string; chromeBinary?: string }> {
  if (options.chromeDriverVersion) {
    return {
      chromeDriverVersion: options.chromeDriverVersion
    };
  }

  let chromeDetails: {
    chromeVersion: string;
    chromeBinary?: string;
  };

  if (options.chromeVersion) {
    chromeDetails = {
      chromeVersion: options.chromeVersion
    };
  } else {
    chromeDetails = await getChromeDetails(options);
  }

  const url = `https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${chromeDetails.chromeVersion}`;

  const chromeDriverVersion = await fetchText(url);

  return {
    chromeDriverVersion,
    ...chromeDetails
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

  return {
    chromeVersion: versionMatch[1],
    chromeBinary: path
  };
}

async function getChromeDriver(chromeDriverVersion: string): Promise<string> {
  const cacheName = require('../package.json').name;
  const cachePath = findCacheDirectory({ name: cacheName, create: true });

  if (cachePath == null) {
    throw new Error('Could not find a cache path');
  }

  const driverPlatform = getDriverPlatform();

  const dest: string = path.join(cachePath, `chromedriver_${chromeDriverVersion}`);
  let driverPath: string = path.join(dest, driverPlatform, 'chromedriver');

  if (process.platform == 'win32') {
    driverPath += '.exe';
  }

  if (fs.existsSync(driverPath)) {
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.statusText);
  }

  if (!response.body) {
    throw new Error('Response has no body');
  }

  await new Promise((resolve, reject) => {
    fs.mkdir(dest, { recursive: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });

  const filePath = path.join(dest, 'chromedriver.zip');
  const writeStream = fs.createWriteStream(filePath);
  await streamPipeline(response.body, writeStream);

  const directory = await unzipper.Open.file(filePath);
  await directory.extract({ path: dest });

  new Promise((resolve) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn(`Could not delete temp file ${filePath}:`, err);
      }
      resolve(resolve);
    });
  });
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
    return 'chromedriver-linux64';
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

  return paths[0];
}
