import { describe, expect, it } from 'vitest';
import { FLAG_COUNTRIES, FLAG_REGIONS, createFlagQuiz, flagChoices, flagFamily, flagQuizReducer, searchFlags } from './flagGame.ts';
import flagLicense from './licenses/flag-icons-LICENSE.txt?raw';
import cldrLicense from './licenses/CLDR-LICENSE.txt?raw';
const svgFiles = import.meta.glob('./flags/*.svg', {eager:true,query:'?raw',import:'default'}) as Record<string,string>;

describe('all-country flag collection and quiz', () => {
	it('has exactly 249 unique bilingual ISO entries and a safe bundled SVG for every entry', () => {
		expect(FLAG_COUNTRIES).toHaveLength(249);
		expect(new Set(FLAG_COUNTRIES.map(country=>country.id)).size).toBe(249);
		const files=Object.keys(svgFiles);expect(files).toHaveLength(249);
		for(const country of FLAG_COUNTRIES){
			expect(country.id).toMatch(/^[a-z]{2}$/);expect(country.label.bn.length).toBeGreaterThan(0);expect(country.label.en.length).toBeGreaterThan(0);
			expect(files).toContain(`./flags/${country.id}.svg`);const svg=svgFiles[`./flags/${country.id}.svg`]!;
			expect(svg).toContain('<svg');expect(svg).toContain('viewBox=');expect(svg).not.toMatch(/<(script|foreignObject)\b|\bonload=/i);
		}
	});
	it('includes the original countries, remote territories and the full alphabetic range',()=>{
		for(const id of ['bd','in','jp','fr','de','br','us','cn','np','va','ps','aq','ax','zw'])expect(FLAG_COUNTRIES.some(country=>country.id===id)).toBe(true);
		expect(flagLicense).toContain('Permission is hereby granted');
		expect(cldrLicense).toContain('UNICODE LICENSE V3');
	});
	it('every country is playable with four stable, distinct choices and no similar-family distractor',()=>{
		for(const country of FLAG_COUNTRIES){const state=createFlagQuiz(91,'all',country.id);const options=flagChoices(state);
			expect(state.deck[0]).toBe(country.id);expect(new Set(options.map(option=>option.id)).size).toBe(4);expect(options.filter(option=>option.id===country.id)).toHaveLength(1);
			expect(options.filter(option=>flagFamily(option.id)===flagFamily(country.id))).toHaveLength(1);
			expect(flagChoices(flagQuizReducer(state,{type:'HINT'}))).toEqual(options);
			const wrong=options.find(option=>option.id!==country.id)!;expect(flagChoices(flagQuizReducer(state,{type:'ANSWER',id:wrong.id}))).toEqual(options);
		}
	});
	it('ten seeded full decks cover all 249 once and finish only after explicit next',()=>{
		for(let seed=0;seed<10;seed++){
			let state=createFlagQuiz(seed);expect(state).toEqual(createFlagQuiz(seed));expect(new Set(state.deck).size).toBe(249);
			for(let index=0;index<249;index++){
				expect(state.index).toBe(index);expect(flagQuizReducer(state,{type:'NEXT'})).toBe(state);
				state=flagQuizReducer(state,{type:'ANSWER',id:state.deck[index]!});expect(state.phase).toBe('correct');expect(state.recognized).toHaveLength(index+1);
				expect(flagQuizReducer(state,{type:'ANSWER',id:state.deck[index]!})).toBe(state);state=flagQuizReducer(state,{type:'NEXT'});
			}expect(state.phase).toBe('finished');expect(flagQuizReducer(state,{type:'SKIP'})).toBe(state);
		}
	});
	it('wrong answers keep the same flag, reveal help after two tries and never award recognition',()=>{
		const initial=createFlagQuiz(1),wrong=flagChoices(initial).find(country=>country.id!==initial.deck[0])!;
		expect(flagQuizReducer(initial,{type:'ANSWER',id:'invalid'})).toBe(initial);
		const first=flagQuizReducer(initial,{type:'ANSWER',id:wrong.id});expect(first.hint).toBe(false);expect(first.index).toBe(0);
		const second=flagQuizReducer(first,{type:'ANSWER',id:wrong.id});expect(second.hint).toBe(true);expect(second.recognized).toEqual([]);
		const skip=flagQuizReducer(second,{type:'SKIP'});expect(skip.index).toBe(1);expect(skip.hint).toBe(false);expect(skip.recognized).toEqual([]);
		expect(initial.attempts).toBe(0);expect(initial.hint).toBe(false);
	});
	it('manual hints do not choose an answer and replaying a recognized flag cannot double count',()=>{
		let state=createFlagQuiz(17);state=flagQuizReducer(state,{type:'HINT'});expect(state.phase).toBe('play');expect(state.recognized).toEqual([]);
		state=flagQuizReducer(state,{type:'ANSWER',id:'bd'});state=createFlagQuiz(18,'all','bd',state.recognized);
		state=flagQuizReducer(state,{type:'ANSWER',id:'bd'});expect(state.recognized).toEqual(['bd']);
	});
	it('supports every continent and Bengali/English/code searches without changing source data',()=>{
		const original=JSON.stringify(FLAG_COUNTRIES);
		for(const region of FLAG_REGIONS){const state=createFlagQuiz(19,region);expect(state.deck.length).toBeGreaterThan(0);expect(state.deck.every(id=>FLAG_COUNTRIES.find(country=>country.id===id)!.continent===region)).toBe(true);expect(searchFlags('',region)).toHaveLength(state.deck.length);}
		expect(searchFlags('বাংলাদেশ').map(country=>country.id)).toEqual(['bd']);expect(searchFlags('  JAPAN ')).toHaveLength(1);expect(searchFlags('jp').some(country=>country.id==='jp')).toBe(true);expect(searchFlags('no country like this')).toEqual([]);
		expect(()=>createFlagQuiz(1,'invalid')).toThrow();expect(JSON.stringify(FLAG_COUNTRIES)).toBe(original);
	});
});
