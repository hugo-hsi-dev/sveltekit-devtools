import { command, query } from '$app/server';

export const greeting = query('unchecked', async (name: string = 'world') => {
	return {
		message: `Hello ${name}`,
		at: new Date().toISOString(),
	};
});

export const double = query('unchecked', async (value: number) => {
	return {
		value,
		doubled: value * 2,
	};
});

export const saveNote = command('unchecked', async (text: string) => {
	return {
		saved: true,
		text,
		at: new Date().toISOString(),
	};
});
