import { describe, expect, it } from 'vitest';
import { ENGLISH_ALPHABET, createEnglishLetterGame, englishLetterReducer, initialEnglishLetterProgress, letterInstruction } from '../../src/numbers/lessons/englishLetters.ts';
import { LETTER_NARRATION } from '../../src/numbers/lessons/letterNarration.ts';
describe('English letter play',()=>{
	it('provides every A–Z exactly once, with a matching English picture word',()=>{
		expect(ENGLISH_ALPHABET.map(e=>e.letter).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
		for(const entry of ENGLISH_ALPHABET){expect(entry.word[0]!.toUpperCase()).toBe(entry.letter);expect(entry.picture.length).toBeGreaterThan(0);}
	});
	it.each(['5-7','8-10'] as const)('%s: 1,000 seeded games have unique choices, playable answers and six guarded rounds',(age)=>{
		const seen=new Set<string>();
		for(let seed=0;seed<1000;seed++){
			const p=createEnglishLetterGame(age,seed);expect(p).toEqual(createEnglishLetterGame(age,seed));expect(p.questions).toHaveLength(6);
			let s=initialEnglishLetterProgress();for(const q of p.questions){expect(new Set(q.options).size).toBe(q.options.length);for(const a of q.answer)expect(q.options).toContain(a);
				if(q.kind==='match'){expect(q.target.toUpperCase()).toBe(q.answer.toUpperCase());expect(q.target).not.toBe(q.answer);seen.add(q.target.toUpperCase());}
				if(q.kind==='sequence'){expect(q.sequence[q.gap]).toBe(q.answer);for(let i=1;i<q.sequence.length;i++)expect(q.sequence[i]!.charCodeAt(0)-q.sequence[i-1]!.charCodeAt(0)).toBe(1);}
				if(q.kind==='word')expect(q.spelling).toBe(age==='8-10');
				for(const a of q.answer)s=englishLetterReducer(p,s,{type:'ANSWER',letter:a});expect(s.phase).toBe('complete');expect(englishLetterReducer(p,s,{type:'ANSWER',letter:q.answer[0]!})).toBe(s);s=englishLetterReducer(p,s,{type:'NEXT'});
			}expect(s.phase).toBe('finished');expect(englishLetterReducer(p,s,{type:'NEXT'})).toBe(s);
		}expect(seen.size).toBe(26);
	});
	it('rejects invalid or wrong-case answers, prevents skipping and holds success',()=>{
		const p=createEnglishLetterGame('5-7',12);let s=initialEnglishLetterProgress();expect(englishLetterReducer(p,s,{type:'NEXT'})).toBe(s);const q=p.questions[0]!;
		s=englishLetterReducer(p,s,{type:'ANSWER',letter:q.answer.toUpperCase()});expect(s.filled).toBe(0);s=englishLetterReducer(p,s,{type:'ANSWER',letter:'?'});expect(s.filled).toBe(0);
		s=englishLetterReducer(p,s,{type:'HINT'});expect(s.hint).toBe(true);s=englishLetterReducer(p,s,{type:'ANSWER',letter:q.answer});expect(s.phase).toBe('complete');expect(englishLetterReducer(p,s,{type:'RESET'})).toBe(s);
	});
	it('spelling retries keep earlier letters and reset affects only this word',()=>{
		const p=createEnglishLetterGame('8-10',4),q=p.questions[2]!;let s={...initialEnglishLetterProgress(),index:2};
		s=englishLetterReducer(p,s,{type:'ANSWER',letter:q.answer[0]!});expect(s.filled).toBe(1);
		s=englishLetterReducer(p,s,{type:'ANSWER',letter:q.options.find(a=>a!==q.answer[1])!});expect(s.filled).toBe(1);s=englishLetterReducer(p,s,{type:'HINT'});expect(s.filled).toBe(1);
		s=englishLetterReducer(p,s,{type:'RESET'});expect(s.index).toBe(2);expect(s.filled).toBe(0);expect(s.hint).toBe(false);
	});
	it('keeps earlier plans/state immutable and has bilingual instructions and feedback',()=>{
		const p=createEnglishLetterGame('8-10',42),original=JSON.stringify(p),initial=initialEnglishLetterProgress();let s=initial;
		const keys=new Set(LETTER_NARRATION.map(e=>e.key));expect(keys.size).toBe(LETTER_NARRATION.length);for(const e of LETTER_NARRATION){expect(e.bn.length).toBeGreaterThan(0);expect(e.en.length).toBeGreaterThan(0);}
		for(const q of p.questions){expect(keys.has(letterInstruction(q))).toBe(true);for(const a of q.answer)s=englishLetterReducer(p,s,{type:'ANSWER',letter:a});expect(keys.has(s.feedbackKey)).toBe(true);s=englishLetterReducer(p,s,{type:'NEXT'});expect(keys.has(s.feedbackKey)).toBe(true);}
		expect(initial).toEqual(initialEnglishLetterProgress());expect(JSON.stringify(p)).toBe(original);
	});
});
