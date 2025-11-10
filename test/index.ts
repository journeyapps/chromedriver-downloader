import { getChromePath, getChromeDetails, downloadChromeDriver, getChromeDriverDetails } from '../src/index';

(global as any).jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe('chromedriver-downloader', () => {
  it('should get the path to chrome', async () => {
    // Some examples:
    //  /usr/bin/google-chrome-stable
    //  /usr/bin/chromium
    //  Google Chrome
    expect(await getChromePath()).toMatch(/chrom/i);

    expect(await getChromePath({ chromeBinary: 'edge.exe' })).toEqual('edge.exe');
  });

  it("should get Chrome's version", async () => {
    expect((await getChromeDetails()).chromeVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should get the relevant ChromeDriver version', async () => {
    expect((await getChromeDriverDetails()).chromeDriverVersion).toMatch(/^\d+\.\d+\.\d+\.\d+$/);

    expect(await getChromeDriverDetails({ chromeVersion: '113.0.5672' })).toEqual({
      chromeDriverVersion: '113.0.5672.63',
      chromeVersion: '113.0.5672'
    });

    expect(await getChromeDriverDetails({ chromeDriverVersion: '1.2.3' })).toEqual({
      chromeDriverVersion: '1.2.3'
    });
  });

  it('should download ChromeDriver', async () => {
    const { chromeDriverPath: path } = await downloadChromeDriver();
    expect(path).toMatch(/chromedriver/i);

    const { chromeDriverPath: path2 } = await downloadChromeDriver();
    expect(path2).toEqual(path);
  });
});
