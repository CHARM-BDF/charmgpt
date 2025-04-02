declare module 'turndown' {
  namespace TurndownService {
    interface Options {
      headingStyle?: 'setext' | 'atx';
      hr?: string;
      bulletListMarker?: '-' | '+' | '*';
      codeBlockStyle?: 'indented' | 'fenced';
      emDelimiter?: '_' | '*';
      strongDelimiter?: '**' | '__';
    }

    interface Node {
      textContent?: string;
    }

    interface Rule {
      filter: (node: Node) => boolean;
      replacement: (content: string, node?: Node) => string;
    }
  }

  class TurndownService {
    constructor(options?: TurndownService.Options);
    turndown(html: string): string;
    use(plugin: unknown): this;
    addRule(key: string, rule: TurndownService.Rule): this;
  }

  export = TurndownService;
}

declare module 'turndown-plugin-gfm' {
  import TurndownService = require('turndown');
  
  export function gfm(turndownService: TurndownService): void;
  export function tables(turndownService: TurndownService): void;
  export function strikethrough(turndownService: TurndownService): void;
} 