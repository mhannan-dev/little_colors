import type { NarrationEntry } from '../../audio/voiceManifest.ts';

export const COLOR_BLOCKS_NARRATION: NarrationEntry[] = [
	{ key: 'mode.color-blocks', bn: 'রঙের ব্লক', en: 'Color Blocks' },
	{ key: 'blocks.instruction', bn: 'ব্লক সরিয়ে একই রং আর চিহ্নের দরজায় নিয়ে যাও।', en: 'Slide each block to the gate with the same color and symbol.' },
	{ key: 'blocks.choose', bn: 'একটি ব্লক বেছে তীর চাপো, অথবা ব্লকটি টেনে সরাও।', en: 'Pick a block and use the arrows, or drag the block.' },
	{ key: 'blocks.blocked', bn: 'এ পথে জায়গা নেই। অন্য দিক দিয়ে দেখি।', en: 'That way is blocked. Try another direction.' },
	{ key: 'blocks.match', bn: 'মিলেছে! ব্লকটি নিজের দরজায় পৌঁছেছে।', en: 'A match! The block reached its gate.' },
	{ key: 'blocks.hint', bn: 'দাগ দেওয়া ব্লকটি তীরের দিকে এক ঘর সরাও।', en: 'Move the outlined block one space in the highlighted direction.' },
	{ key: 'blocks.undoHint', bn: 'পথ খুলতে আগের চালটি ফেরাও।', en: 'Undo your last move to open a path.' },
	{ key: 'blocks.clear', bn: 'দারুণ! সব ব্লক নিজের দরজায় পৌঁছেছে।', en: 'Well done! Every block reached its gate.' },
	{ key: 'blocks.done', bn: 'অভিনন্দন! সব রঙের ধাঁধা মিলে গেছে।', en: 'Congratulations! You solved all the color puzzles.' },
	{ key: 'blocks.next', bn: 'পরের ধাঁধা', en: 'Next puzzle' }
].map(entry => ({ ...entry, islamic: false, status: 'placeholder' }));
