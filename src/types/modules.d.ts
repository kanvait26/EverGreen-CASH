declare module "arabic-reshaper" {
  export function convertArabic(text: string): string;
  const _default: (text: string) => string;
  export default _default;
}

declare module "bidi-js" {
  export default function bidiFactory(): {
    getReorderedString: (text: string) => string;
  };
}
