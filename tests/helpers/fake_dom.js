/**
 * @fileoverview Minimal fake DOM environment for Node.js smoke tests.
 * Enables loading Three.js and browser modules in a node:vm context without JSDOM.
 * Strictly implements DESIGN.md section 7.4.
 */
const nodeVm = require('node:vm');
const nodeFs = require('node:fs');
const nodePath = require('node:path');

/**
 * Fake Image implementation that never triggers onload or onerror.
 */
class FakeImage {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.src = '';
    this.onload = null;
    this.onerror = null;
    this.complete = false;
  }
}

/**
 * Fake Canvas element providing dimensions, styles, and a 2D rendering proxy.
 */
class FakeCanvas {
  /**
   * @param {number=} width Initial canvas width.
   * @param {number=} height Initial canvas height.
   */
  constructor(width = 300, height = 150) {
    this.width = width;
    this.height = height;
    this.style = {};
    this._context2d = null;
  }

  /**
   * Returns a 2D drawing context proxy.
   * @param {string} contextType The requested context type.
   * @return {?Object} Fake 2D context proxy or null.
   */
  getContext(contextType) {
    if (contextType === '2d') {
      if (!this._context2d) {
        this._context2d = createFake2DContext(this);
      }
      return this._context2d;
    }
    return null;
  }

  /**
   * Serializes canvas data to a fake PNG data URI.
   * @return {string} A dummy PNG data URI.
   */
  toDataURL() {
    return 'data:image/png;base64,fake';
  }
}

/**
 * Creates a Proxy around CanvasRenderingContext2D where every method is a no-op
 * except measureText, gradient/pattern creators, and getImageData.
 * @param {!FakeCanvas} canvasInstance The parent FakeCanvas.
 * @return {!Object} The proxy context.
 */
function createFake2DContext(canvasInstance) {
  const contextTarget = {
    canvas: canvasInstance,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    measureText: (text) => ({
      width: text ? String(text).length * 10 : 0,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    createPattern: () => ({}),
    getImageData: (x, y, width, height) => ({
      data: new Uint8ClampedArray(
        Math.max(1, (Math.floor(width) || 1) * (Math.floor(height) || 1) * 4)
      ),
    }),
  };

  return new Proxy(contextTarget, {
    get(target, property) {
      if (property in target) {
        return target[property];
      }
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
}

/**
 * Builds an in-memory Storage implementation for localStorage.
 * @return {!Object} In-memory Storage object.
 */
function createFakeLocalStorage() {
  const storageMap = new Map();
  return {
    getItem(key) {
      return storageMap.has(key) ? storageMap.get(key) : null;
    },
    setItem(key, value) {
      storageMap.set(String(key), String(value));
    },
    removeItem(key) {
      storageMap.delete(String(key));
    },
    clear() {
      storageMap.clear();
    },
    get length() {
      return storageMap.size;
    },
    key(index) {
      return Array.from(storageMap.keys())[index] || null;
    },
  };
}

/**
 * Creates a vm context whose global object is also window and globalThis, with document,
 * Image, performance, requestAnimationFrame, localStorage, navigator, and console.
 * Strictly per DESIGN.md section 7.4 (no fonts property on document).
 * @return {!nodeVm.Context} The configured Node VM context.
 */
function createContext() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.console = console;
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.setInterval = setInterval;
  sandbox.clearInterval = clearInterval;
  sandbox.performance = { now: () => Date.now() };
  sandbox.requestAnimationFrame = () => 0;
  sandbox.cancelAnimationFrame = () => {};
  sandbox.navigator = { userAgent: 'Node Fake DOM' };
  sandbox.localStorage = createFakeLocalStorage();
  sandbox.Image = FakeImage;
  sandbox.HTMLImageElement = FakeImage;
  sandbox.HTMLCanvasElement = FakeCanvas;

  const fakeDocument = {
    createElement(tagName) {
      const lowerTag = String(tagName).toLowerCase();
      if (lowerTag === 'canvas') {
        return new FakeCanvas();
      }
      if (lowerTag === 'img') {
        return new FakeImage();
      }
      return {
        style: {},
        appendChild: () => {},
        removeChild: () => {},
      };
    },
    createElementNS(namespaceUri, qualifiedName) {
      return fakeDocument.createElement(qualifiedName);
    },
    getElementById: () => null,
    body: {
      appendChild: () => {},
      removeChild: () => {},
      style: {},
    },
    head: {
      appendChild: () => {},
      removeChild: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  sandbox.document = fakeDocument;
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};

  return nodeVm.createContext(sandbox);
}

/**
 * Resolves paths against the project root and runs each script in the specified VM context.
 * @param {!nodeVm.Context} context The VM context created via createContext().
 * @param {!Array<string>} relativePaths Relative paths from project root.
 */
function loadScripts(context, relativePaths) {
  const projectRoot = nodePath.resolve(__dirname, '..', '..');
  for (const relativePath of relativePaths) {
    const absolutePath = nodePath.resolve(projectRoot, relativePath);
    const sourceCode = nodeFs.readFileSync(absolutePath, 'utf8');
    nodeVm.runInContext(sourceCode, context, { filename: absolutePath });
  }
}

module.exports = {
  createContext,
  loadScripts,
};
