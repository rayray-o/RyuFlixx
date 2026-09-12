export interface IframeSource {
  id: string;
  label: string;
  url: string;
  height?: number;
}

// ============================================
// PASTE YOUR 12 URLS BELOW — inside the quotes
// on the `url:` line for each frame.
// Must start with https:// or http://
// Leave `url: ''` empty for any frame not in use.
// ============================================

export const IFRAME_SOURCES: IframeSource[] = [
  { id: 'frame-1',  label: 'Frame 1',  url: '', height: 500 },
  { id: 'frame-2',  label: 'Frame 2',  url: '', height: 500 },
  { id: 'frame-3',  label: 'Frame 3',  url: '', height: 500 },
  { id: 'frame-4',  label: 'Frame 4',  url: '', height: 500 },
  { id: 'frame-5',  label: 'Frame 5',  url: '', height: 500 },
  { id: 'frame-6',  label: 'Frame 6',  url: '', height: 500 },
  { id: 'frame-7',  label: 'Frame 7',  url: '', height: 500 },
  { id: 'frame-8',  label: 'Frame 8',  url: '', height: 500 },
  { id: 'frame-9',  label: 'Frame 9',  url: '', height: 500 },
  { id: 'frame-10', label: 'Frame 10', url: '', height: 500 },
  { id: 'frame-11', label: 'Frame 11', url: '', height: 500 },
  { id: 'frame-12', label: 'Frame 12', url: '', height: 500 },
];
