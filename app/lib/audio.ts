'use client';

// Audio files
const AUDIO_FILES = {
  TURN_START: '/sounds/your-turn.mp3',
  TURN_WARNING: '/sounds/time-warning.mp3',
  DEAL_CARDS: '/sounds/deal-cards.mp3',
  DEAL_FLOP: '/sounds/deal-flop.mp3',
  DEAL_TURN: '/sounds/deal-turn.mp3',
  DEAL_RIVER: '/sounds/deal-river.mp3',
  WINNER: '/sounds/winner.mp3',
} as const;

class AudioManager {
  private static instance: AudioManager;
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  private constructor() {
    // Only initialize if window is defined (client-side)
    if (typeof window !== 'undefined') {
      this.initializeAudio();
    }
  }

  private initializeAudio() {
    if (this.isInitialized) return;
    
    Object.entries(AUDIO_FILES).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      this.audioElements.set(key, audio);
    });
    
    this.isInitialized = true;
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public playSound(soundKey: keyof typeof AUDIO_FILES) {
    if (this.isMuted || typeof window === 'undefined') return;
    
    // Initialize if not done yet (in case of lazy loading)
    if (!this.isInitialized) {
      this.initializeAudio();
    }
    
    const audio = this.audioElements.get(soundKey);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(err => console.error('Error playing sound:', err));
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
  }
}

export const audioManager = AudioManager.getInstance(); 