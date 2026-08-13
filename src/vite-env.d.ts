/// <reference types="vite/client" />

/** mammoth types cover its Node entry only; the browser build's one function is declared here. */
declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>;
  };
  export default mammoth;
}
