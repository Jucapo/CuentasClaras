import { detectInstallPlatform } from './install-platform';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

describe('detectInstallPlatform', () => {
  it('detects iPhone, also in other browsers, which install through Share too', () => {
    expect(detectInstallPlatform(IPHONE, 5)).toBe('ios');
    expect(detectInstallPlatform(CHROME_IOS, 5)).toBe('ios');
  });

  it('tells an iPad, which reports a Mac, apart from a Mac by touch support', () => {
    expect(detectInstallPlatform(IPAD_DESKTOP_MODE, 5)).toBe('ios');
    expect(detectInstallPlatform(IPAD_DESKTOP_MODE, 0)).toBe('other');
  });

  it('detects Android and leaves desktops as other', () => {
    expect(detectInstallPlatform(ANDROID, 5)).toBe('android');
    expect(detectInstallPlatform(WINDOWS, 0)).toBe('other');
  });
});
