import { describe, it, expect } from 'vitest';
import {
  isArtifactPreviewable,
  getArtifactType,
  getArtifactExtension,
  getArtifactMimeType,
  generateSandboxedHtml,
  VIEWPORT_WIDTHS,
} from '../src/renderer/src/utils/artifact-utils';

describe('Artifact Preview Utilities', () => {
  describe('isArtifactPreviewable', () => {
    it('should detect html and htm languages', () => {
      expect(isArtifactPreviewable('html', '<div>Hello</div>')).toBe(true);
      expect(isArtifactPreviewable('HTML', '<h1>Title</h1>')).toBe(true);
      expect(isArtifactPreviewable('htm', '<p>Paragraph</p>')).toBe(true);
    });

    it('should detect svg language and svg in xml/markup', () => {
      expect(isArtifactPreviewable('svg', '<svg viewBox="0 0 100 100"><circle r="50"/></svg>')).toBe(true);
      expect(isArtifactPreviewable('xml', '<svg><rect width="10" height="10"/></svg>')).toBe(true);
      expect(isArtifactPreviewable('markup', '<svg width="24" height="24"></svg>')).toBe(true);
    });

    it('should detect untagged full html documents', () => {
      const fullDoc = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hi</h1></body></html>';
      expect(isArtifactPreviewable('', fullDoc)).toBe(true);
      expect(isArtifactPreviewable(undefined, fullDoc)).toBe(true);
    });

    it('should reject non-previewable languages', () => {
      expect(isArtifactPreviewable('python', 'print("hello")')).toBe(false);
      expect(isArtifactPreviewable('typescript', 'const x: number = 42;')).toBe(false);
      expect(isArtifactPreviewable('json', '{"name": "test"}')).toBe(false);
      expect(isArtifactPreviewable('bash', 'echo "hello"')).toBe(false);
      expect(isArtifactPreviewable('html', '')).toBe(false);
      expect(isArtifactPreviewable('html', '   ')).toBe(false);
    });
  });

  describe('getArtifactType', () => {
    it('should distinguish between html and svg', () => {
      expect(getArtifactType('html', '<div>Hi</div>')).toBe('html');
      expect(getArtifactType('svg', '<svg></svg>')).toBe('svg');
      expect(getArtifactType('xml', '<svg viewBox="0 0 10 10"></svg>')).toBe('svg');
      expect(getArtifactType('python', 'x = 1')).toBe(null);
    });
  });

  describe('Metadata and extensions', () => {
    it('should provide correct extensions and mime types', () => {
      expect(getArtifactExtension('html')).toBe('.html');
      expect(getArtifactExtension('svg')).toBe('.svg');
      expect(getArtifactMimeType('html')).toBe('text/html');
      expect(getArtifactMimeType('svg')).toBe('image/svg+xml');
    });

    it('should define viewport widths', () => {
      expect(VIEWPORT_WIDTHS.desktop).toBe('100%');
      expect(VIEWPORT_WIDTHS.tablet).toBe('768px');
      expect(VIEWPORT_WIDTHS.mobile).toBe('375px');
    });
  });

  describe('generateSandboxedHtml', () => {
    it('should wrap SVG in dark mode shell with responsive layout', () => {
      const svgCode = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
      const generated = generateSandboxedHtml(svgCode, 'svg', true);

      expect(generated).toContain('<!DOCTYPE html>');
      expect(generated).toContain('.svg-container');
      expect(generated).toContain(svgCode);
      expect(generated).toContain('#09090b'); // Dark background
    });

    it('should wrap SVG in light mode when specified', () => {
      const svgCode = '<svg><rect/></svg>';
      const generated = generateSandboxedHtml(svgCode, 'svg', false);

      expect(generated).toContain('#ffffff'); // Light background
      expect(generated).toContain(svgCode);
    });

    it('should wrap HTML fragments in an HTML5 document shell', () => {
      const fragment = '<div class="card"><h2>Card Title</h2><p>Content</p></div>';
      const generated = generateSandboxedHtml(fragment, 'html', true);

      expect(generated).toContain('<!DOCTYPE html>');
      expect(generated).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      expect(generated).toContain(fragment);
      expect(generated).toContain('window.onerror');
    });

    it('should augment full HTML documents without breaking structure', () => {
      const fullDoc = '<!DOCTYPE html><html><head><title>App</title></head><body><h1>Welcome</h1></body></html>';
      const generated = generateSandboxedHtml(fullDoc, 'html', true);

      expect(generated).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      expect(generated).toContain('window.onerror');
      expect(generated).toContain('<h1>Welcome</h1>');
    });
  });
});
