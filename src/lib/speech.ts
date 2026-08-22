/** Queue local browser speech so phrases never overlap. */

let chain: Promise<void> = Promise.resolve();

function speakNow(text: string): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

/** Queue a phrase for playback. Resolves when this phrase finished streaming. */
export function speak(text: string): Promise<void> {
  chain = chain.then(() => speakNow(text).catch((error) => console.error(error)));
  return chain;
}

export function primeAudio() {
  // SpeechSynthesis is unlocked by the user's Start button interaction.
}
