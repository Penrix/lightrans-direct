/**
 * Local TTS service provider.
 */
class LocalTTS {
    constructor() {
        this.speaking = false;
        // MV3 后台 service worker 运行在非 DOM 环境，没有 window。
        // speechSynthesis 仅存在于页面上下文，这里做安全降级，避免模块加载即抛错导致 SW 注册失败。
        this.synthesis =
            typeof window !== "undefined" && window.speechSynthesis
                ? window.speechSynthesis
                : null;
    }

    /**
     * Speak given text.
     *
     * @param {String} text text to pronounce
     * @param {String} language language of text
     * @param {String} speed "fast" or "slow"
     *
     * @returns {boolean} is speaking succeeded?
     */
    speak(text, language, speed) {
        // 当前上下文不支持 Web Speech API（如 MV3 service worker）时安全降级
        if (!this.synthesis) {
            console.log(
                "LocalTTS: speechSynthesis unavailable in this context, skip local TTS"
            );
            return false;
        }

        // Check if the language is supported.
        if (!this.synthesis.getVoices().find((voice) => voice.lang.startsWith(language))) {
            console.log(`No voice for language: "${language}"`);
            return false;
        }

        this.speaking = true;
        let utter = new SpeechSynthesisUtterance(text);
        utter.rate = speed === "fast" ? 1.0 : 0.6;

        // Set speaking to false when finished speaking.
        utter.onend = (() => (this.speaking = false)).bind(this);

        this.synthesis.speak(utter);
        return true;
    }

    /**
     * Pause speaking.
     */
    pause() {
        if (this.speaking && this.synthesis) {
            this.synthesis.cancel();
            this.speaking = false;
        }
    }
}

export default LocalTTS;
