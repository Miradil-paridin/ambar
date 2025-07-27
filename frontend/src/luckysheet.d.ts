declare module 'luckysheet/dist/luckysheet.umd.js' {
  const luckysheet: any;
  export default luckysheet;
}

declare global {
  interface Window {
    luckysheet: any;
  }
} 