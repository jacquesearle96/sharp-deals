import { describe, expect, it } from 'vitest';
import { note, takeNotes } from '../src/diagnostics.ts';

describe('diagnostics', () => {
  it('collects notes and hands them over once', () => {
    takeNotes();
    note('first');
    note('second');
    expect(takeNotes()).toEqual(['first', 'second']);
    expect(takeNotes()).toEqual([]);
  });
  it('keeps only a handful of notes and trims long ones', () => {
    takeNotes();
    for (let i = 0; i < 20; i++) note('x'.repeat(500));
    const notes = takeNotes();
    expect(notes).toHaveLength(8);
    expect(notes[0]).toHaveLength(300);
  });
});
