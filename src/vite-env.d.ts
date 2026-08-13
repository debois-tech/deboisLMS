/// <reference types="vite/client" />

/**
 * mammoth ships types for its Node entry only. The browser build is the one this
 * app can bundle, so the one function used against it is declared here.
 */
declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>;
  };
  export default mammoth;
}
