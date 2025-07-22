declare module '@nightingale-elements/nightingale-manager' {
  export {};
}

declare module '@nightingale-elements/nightingale-sequence' {
  export {};
}

declare module '@nightingale-elements/nightingale-track' {
  export {};
}

declare module '@nightingale-elements/nightingale-navigation' {
  export {};
}

declare module '@nightingale-elements/nightingale-colored-sequence' {
  export {};
}

// Extend HTMLElementTagNameMap for TypeScript support
declare global {
  interface HTMLElementTagNameMap {
    'nightingale-manager': any;
    'nightingale-sequence': any;
    'nightingale-track': any;
    'nightingale-navigation': any;
    'nightingale-colored-sequence': any;
  }
} 