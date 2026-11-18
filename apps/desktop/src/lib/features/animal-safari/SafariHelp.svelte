<script lang="ts">
	import { onMount } from 'svelte';
	let { bn, soundEnabled, onclose, onspeak }: { bn: boolean; soundEnabled: boolean; onclose: () => void; onspeak: (text: string) => void } = $props();
	let dialog: HTMLDialogElement;
	let step = $state(0);
	const steps = [
		{ icon: '🚙', picture: '🌳 🚙 🌳', title: 'Hop into the jeep', titleBn: 'জিপে উঠে পড়ি', text: 'Pick an adventure card. Our jeep drives by itself and stops when it is time to play.', textBn: 'একটি অভিযানের কার্ডে ট্যাপ করি। জিপ নিজেই চলবে, খেলার জায়গায় থামবে।' },
		{ icon: '👆', picture: '🐘 ☝️', title: 'Look and tap', titleBn: 'দেখি আর ট্যাপ করি', text: 'Look at the animal picture beside the question. Tap the matching animal in the clearing. A wrong tap is okay. Try again!', textBn: 'প্রশ্নের পাশের প্রাণীর ছবিটি দেখি। মাঠে সেই প্রাণীটিতে ট্যাপ করি। ভুল হলে আবার চেষ্টা করি!' },
		{ icon: '🔊', picture: '🔊 → 🦁', title: 'Listen to a call', titleBn: 'প্রাণীর ডাক শুনি', text: 'Tap the speaker to hear a toy animal call. Then tap the animal. Hint shows a picture if you need help, even with sound off.', textBn: 'স্পিকারে ট্যাপ করে প্রাণীর খেলনা ডাক শুনি। তারপর প্রাণীটিতে ট্যাপ করি। সাহায্য চাপলে ছবি দেখাবে, শব্দ বন্ধ থাকলেও।' },
		{ icon: '🐰', picture: '🐰 ✓ 🐰 ✓', title: 'Count one at a time', titleBn: 'একটি একটি করে গুনি', text: 'Tap each rabbit once. A check mark means it is already counted. Keep going until every rabbit has a check.', textBn: 'প্রতিটি খরগোশে একবার ট্যাপ করি। টিক চিহ্ন মানে সেটি গোনা হয়েছে। সব খরগোশে টিক না হওয়া পর্যন্ত গুনি।' },
		{ icon: '🥕', picture: '🐰 + 🥕 = 💚', title: 'Match the snack', titleBn: 'খাবারটি মিলিয়ে দিই', text: 'Look at the snack picture. Tap that same snack button below the clearing. After each discovery, tap Next stop. Hint points out what to tap.', textBn: 'খাবারের ছবিটি দেখি। মাঠের নিচে সেই খাবারের বোতামে ট্যাপ করি। শেখা হলে পরের জায়গায় যাই চাপি। সাহায্য দেখাবে কোথায় ট্যাপ করতে হবে।' }
	] as const;
	const current = $derived(steps[step]);
	const title = $derived(bn ? current.titleBn : current.title);
	const text = $derived(bn ? current.textBn : current.text);
	$effect(() => { onspeak(text); });
	onMount(() => {
		const previous = document.activeElement;
		dialog.showModal();
		return () => { dialog.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
	});
</script>

<dialog bind:this={dialog} aria-labelledby="safari-help-title" aria-describedby="safari-help-text" oncancel={(event) => { event.preventDefault(); onclose(); }}>
	<div class="help-top"><p>{bn ? 'রুমির ছোট্ট গাইড' : 'RUMI’S LITTLE GUIDE'}</p><button class="close" aria-label={bn ? 'নির্দেশনা বন্ধ করি' : 'Close guide'} onclick={onclose}>✕</button></div>
	<h2 id="safari-help-title">{bn ? 'কীভাবে খেলব' : 'How to play'}</h2>
	<div class="steps" role="group" aria-label={bn ? 'খেলার ধাপ' : 'Guide steps'}>{#each steps as item, i}<button aria-label={bn ? item.titleBn : item.title} aria-pressed={step === i} onclick={() => step = i}><span aria-hidden="true">{item.icon}</span></button>{/each}</div>
	<div class="picture" aria-hidden="true">{current.picture}</div>
	<h3>{title}</h3><p id="safari-help-text">{text}</p>
	<button class="read" disabled={!soundEnabled} onclick={() => onspeak(text)}>🔊 {bn ? 'আবার শুনি' : 'Hear this step'}</button>
	<p class="calm">🌿 {bn ? 'সময় নিয়ে খেলি। কোনো তাড়া নেই।' : 'Take your time. There is no hurry.'}</p>
	<div class="actions"><button disabled={step === 0} onclick={() => step--}>← {bn ? 'আগের ধাপ' : 'Previous'}</button>{#if step < steps.length - 1}<button class="primary" onclick={() => step++}>{bn ? 'পরের ধাপ' : 'Next step'} →</button>{:else}<button class="primary" onclick={onclose}>✓ {bn ? 'চলো খেলি' : 'Let’s explore'}</button>{/if}</div>
</dialog>

<style>
	dialog { width: min(520px, calc(100vw - 28px)); max-height: calc(100dvh - 32px); overflow-y: auto; padding: 24px; border: 2px solid #bfd1ae; border-radius: 28px; background: #fffdf4; color: #29473b; box-shadow: 0 24px 80px #162c3259; text-align: center; }
	dialog::backdrop { background: #183b3b80; backdrop-filter: blur(5px); }
	.help-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; } .help-top p { font-size: 11px; letter-spacing: .12em; font-weight: 800; color: #527b60; margin: 0; }
	button { min-height: 46px; border: 2px solid #d1ddc9; border-radius: 14px; background: white; color: inherit; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; padding: 7px 13px; }
	button:disabled { opacity: .45; cursor: default; } button:hover:not(:disabled) { border-color: #709570; } .close { min-width: 46px; }
	h2 { margin: 6px 0 18px; font-size: 30px; line-height: 1.2; } h3 { margin: 16px 0 8px; font-size: 23px; line-height: 1.3; }
	.steps { display: flex; justify-content: center; gap: 8px; } .steps button { flex: 1; max-width: 68px; padding: 7px; font-size: 27px; } .steps button[aria-pressed='true'] { background: #e0efce; border-color: #75966a; }
	.picture { margin-top: 20px; display: grid; place-items: center; min-height: 112px; padding: 18px 10px; border-radius: 22px; background: linear-gradient(145deg, #e2eed7, #f7edc8); font-size: clamp(30px, 6vw, 45px); white-space: nowrap; }
	#safari-help-text { min-height: 82px; margin: 0; font-size: 18px; line-height: 1.5; color: #52695b; } .read { font-size: 14px; margin-top: 12px; } .calm { font-size: 14px; color: #597a56; margin: 18px 0 0; }
	.actions { display: flex; gap: 10px; margin-top: 18px; } .actions button { flex: 1; } .primary { color: white; background: #427859; border-color: #356448; }
	@media(max-width:500px) { dialog { padding: 16px; border-radius: 22px; } h2 { font-size: 26px; } #safari-help-text { font-size: 17px; } .steps { gap: 6px; } .picture { min-height: 96px; } }
</style>
