import type {NarrationEntry} from '../../audio/voiceManifest.ts';
import {LEARNING_FRUITS} from './fruitLearning.ts';
export const FRUIT_NARRATION:NarrationEntry[]=[
	{key:'mode.fruit',bn:'ফল চিনি',en:'Fruit Garden'},
	{key:'fruit.title',bn:'রুমির ফলের বাগান',en:'Rumi’s Fruit Garden'},
	{key:'fruit.learn',bn:'ফল দেখে শিখি',en:'Explore fruits'},
	{key:'fruit.play',bn:'ফল নিয়ে খেলি',en:'Play fruit games'},
	{key:'fruit.all',bn:'সব ফল',en:'All fruits'},
	{key:'fruit.familiar',bn:'বাংলাদেশে পরিচিত ফল',en:'Familiar fruits in Bangladesh'},
	{key:'fruit.explore',bn:'যেকোনো ফল বেছে তার ছবি আর বাংলা–ইংরেজি নাম শিখি।',en:'Choose a fruit to explore its picture and Bengali and English names.'},
	{key:'fruit.listen',bn:'নাম শুনি',en:'Hear the name'},
	{key:'fruit.instruction.name',bn:'ছবিতে কোন ফলটি আছে? সঠিক নাম বেছে নাও।',en:'Which fruit is in the picture? Choose its name.'},
	{key:'fruit.instruction.find',bn:'দেখানো নামের ফলের ছবিটি খুঁজে বেছে নাও।',en:'Find the fruit picture that matches the name.'},
	{key:'fruit.instruction.count',bn:'একটি করে ফলের ছবিতে চাপ দাও। মোট কতটি ছবি আছে গুনে বেছে নাও।',en:'Tap each fruit picture once. Count the pictures and choose the total.'},
	{key:'fruit.correct',bn:'মিলেছে! ফলটি রুমির ঝুড়িতে গেছে। তৈরি হলে পরের খেলায় যাই।',en:'It matches! The fruit is in Rumi’s basket. Continue when you are ready.'},
	{key:'fruit.retry',bn:'আরেকবার দেখে চেষ্টা করি। আগের ফলগুলো ঝুড়িতে আছে।',en:'Let’s look again. The earlier fruits stay in the basket.'},
	{key:'fruit.hint',bn:'দাগ দেওয়া পছন্দটি দেখে ছবির সঙ্গে মিলিয়ে নাও।',en:'Look at the outlined choice and compare it with the picture.'},
	{key:'fruit.help',bn:'একটু সাহায্য',en:'A little help'},
	{key:'fruit.reset',bn:'গোনার দাগ মুছি',en:'Clear counting marks'},
	{key:'fruit.next',bn:'পরের ফলের খেলা',en:'Next fruit game'},
	{key:'fruit.basket',bn:'রুমির ফলের ঝুড়ি',en:'Rumi’s fruit basket'},
	{key:'fruit.done',bn:'ছয়টি ফল ঝুড়িতে এসেছে! হি হি, রুমি কলাকে ফোন ভেবেছে! একটু বিরতি নিয়ে আবার খেলতে পারো।',en:'Six fruits are in the basket! Hee hee, Rumi thinks a banana is a phone! Take a little break before playing again.'},
	{key:'fruit.replay',bn:'নতুন ফল নিয়ে খেলি',en:'Play with new fruits'},
	{key:'fruit.joke',bn:'হ্যালো! রুমি কলার ফোনে বলছে, ফলের বাগানে এসো!',en:'Hello! Rumi’s banana phone says, come to the fruit garden!'},
	{key:'fruit.giggle',bn:'রুমির কলার ফোন',en:'Rumi’s banana phone'},
	{key:'fruit.counted',bn:'গোনা হয়েছে',en:'Counted'},
	...LEARNING_FRUITS.map(fruit=>({key:`fruit.name.${fruit.id}`,bn:fruit.bn,en:fruit.en}))
].map(entry=>({...entry,islamic:false,status:'placeholder'}));
