/* ==============================================
   Trivia Master Wiki - Aplicación Principal
   Versión: 1.0
   ============================================== */

/* ==============================================
   SECCIÓN 1: CONSTANTES Y CONFIGURACIÓN
   ============================================== */

const CONFIG = {
  API_BASE: 'https://es.wikipedia.org/w/api.php',
  API_PARAMS: '?action=query&format=json&origin=*',
  USER_AGENT: 'TriviaMasterWiki/1.0',
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,
  TIMEOUT: 10000,
  MAX_EXTRACT_LENGTH: 130,
  PRELOAD_COUNT: 15,
  FAST_ANSWER_BONUS: 50,
  STREAK_3: { threshold: 3, points: 100 },
  STREAK_5: { threshold: 5, points: 250 },
  STREAK_10: { threshold: 10, points: 500 },
  BASE_SCORE: 100,
  CORRECT_COINS: 10,
  STREAK_COINS: 20,
  HELP_COSTS: { '5050': 20, hint: 15, audience: 25, freeze: 30 },
  DIFFICULTY: {
    easy: { time: 20, label: 'Fácil' },
    medium: { time: 15, label: 'Media' },
    hard: { time: 10, label: 'Difícil' }
  },
  CATEGORIES: {
    Historia: 'Categoría:Historia',
    Geografía: 'Categoría:Geografía',
    Ciencia: 'Categoría:Ciencia',
    Tecnología: 'Categoría:Tecnología',
    Matemáticas: 'Categoría:Matemáticas',
    Deportes: 'Categoría:Deporte',
    Música: 'Categoría:Música',
    Cine: 'Categoría:Cine',
    'Cultura General': 'Categoría:Cultura'
  },
  ACHIEVEMENTS: [
    { id: 'first-correct', icon: '🏆', name: 'Primer Acierto', desc: 'Responde correctamente tu primera pregunta' },
    { id: '10-correct', icon: '🎯', name: '10 Correctas', desc: 'Acumula 10 respuestas correctas' },
    { id: '50-correct', icon: '🌟', name: '50 Correctas', desc: 'Acumula 50 respuestas correctas' },
    { id: 'history-master', icon: '📜', name: 'Maestro de Historia', desc: 'Gana una partida en categoría Historia' },
    { id: 'science-expert', icon: '🔬', name: 'Experto en Ciencia', desc: 'Gana una partida en categoría Ciencia' },
    { id: 'trivia-legend', icon: '👑', name: 'Leyenda de la Trivia', desc: 'Alcanza 1000 puntos en una partida' },
    { id: 'streak-5', icon: '🔥', name: 'Racha de 5', desc: 'Consigue 5 aciertos seguidos' }
  ]
};

/* ==============================================
   SECCIÓN 2: UTILIDADES
   ============================================== */

const Utils = {
  $(sel, ctx) { return (ctx || document).querySelector(sel); },
  $$(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; },
  rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Utils.rand(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trim() + '…';
  },
  formatDate() {
    return new Date().toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },
  formatDateShort(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  },
  delay(ms) { return new Promise(r => setTimeout(r, ms)); },
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  getAnswerLetter(index) { return String.fromCharCode(65 + index); }
};

/* ==============================================
   SECCIÓN 3: MÓDULO DE SONIDOS (Web Audio API)
   ============================================== */

const Sound = {
  ctx: null,
  enabled: true,

  init() {
    Sound.enabled = Storage.get('soundEnabled', true);
  },

  async ensureCtx() {
    if (!Sound.ctx) {
      Sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (Sound.ctx.state === 'suspended') {
      await Sound.ctx.resume();
    }
  },

  play(type) {
    if (!Sound.enabled) return;
    Sound.ensureCtx().then(() => {
      const c = Sound.ctx;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);

      switch (type) {
        case 'correct': {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.08);
          osc.frequency.setValueAtTime(783.99, now + 0.16);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
          break;
        }
        case 'incorrect': {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.setValueAtTime(160, now + 0.12);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }
        case 'timeout': {
          osc.type = 'square';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(350, now + 0.15);
          osc.frequency.setValueAtTime(280, now + 0.3);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.45);
          break;
        }
        case 'achievement': {
          osc.type = 'sine';
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, i) => {
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
          });
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
          break;
        }
        case 'victory': {
          osc.type = 'sine';
          const melody = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
          melody.forEach((freq, i) => {
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
          });
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
          osc.start(now);
          osc.stop(now + 1.0);
          break;
        }
      }
    }).catch(() => {});
  },

  toggle() {
    Sound.enabled = !Sound.enabled;
    Storage.set('soundEnabled', Sound.enabled);
    return Sound.enabled;
  }
};

/* ==============================================
   SECCIÓN 4: MÓDULO DE ALMACENAMIENTO (LocalStorage)
   ============================================== */

const Storage = {
  get(key, def) {
    try {
      const val = localStorage.getItem('tmw_' + key);
      return val !== null ? JSON.parse(val) : def;
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('tmw_' + key, JSON.stringify(val)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem('tmw_' + key); } catch {}
  },

  init() {
    if (!Storage.get('stats', null)) {
      Storage.set('stats', { games: 0, correct: 0, incorrect: 0, bestScore: 0, coins: 0 });
    }
    if (!Storage.get('achievements', null)) {
      Storage.set('achievements', {});
    }
    if (!Storage.get('ranking', null)) {
      Storage.set('ranking', []);
    }
  },

  getStats() { return Storage.get('stats', { games: 0, correct: 0, incorrect: 0, bestScore: 0, coins: 0 }); },
  saveStats(s) { Storage.set('stats', s); },

  getAchievements() { return Storage.get('achievements', {}); },
  saveAchievements(a) { Storage.set('achievements', a); },

  getRanking() { return Storage.get('ranking', []); },
  saveRanking(r) { Storage.set('ranking', r); },

  addRanking(name, points, category) {
    const ranking = Storage.getRanking();
    ranking.push({
      name: name || 'Anónimo',
      points,
      category: category || 'Aleatorio',
      date: Utils.formatDate(),
      timestamp: Date.now()
    });
    ranking.sort((a, b) => b.points - a.points);
    if (ranking.length > 50) ranking.length = 50;
    Storage.saveRanking(ranking);
  },

  resetAll() {
    ['stats', 'achievements', 'ranking', 'soundEnabled'].forEach(k => Storage.remove(k));
    Storage.init();
  }
};

/* ==============================================
   SECCIÓN 5: MÓDULO DE WIKIPEDIA API
   ============================================== */

const Wikipedia = {
  _cache: new Map(),
  _pending: new Map(),

  async fetch(url) {
    if (Wikipedia._cache.has(url)) return Wikipedia._cache.get(url);

    if (Wikipedia._pending.has(url)) {
      return Wikipedia._pending.get(url);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    const promise = (async () => {
      for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': CONFIG.USER_AGENT }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          clearTimeout(timeout);
          Wikipedia._cache.set(url, data);
          return data;
        } catch (err) {
          clearTimeout(timeout);
          if (attempt < CONFIG.MAX_RETRIES) {
            await Utils.delay(CONFIG.RETRY_DELAY * (attempt + 1));
          } else {
            throw err;
          }
        }
      }
    })();

    Wikipedia._pending.set(url, promise);
    const result = await promise;
    Wikipedia._pending.delete(url);
    return result;
  },

  async getCategoryArticles(category) {
    const cat = CONFIG.CATEGORIES[category];
    if (!cat) throw new Error('Categoría no encontrada');
    const url = `${CONFIG.API_BASE}${CONFIG.API_PARAMS}&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmtype=page&cmlimit=50`;
    const data = await Wikipedia.fetch(url);
    return (data.query && data.query.categorymembers || [])
      .map(m => m.title)
      .filter(t => t && !t.includes(':'));
  },

  async getRandomArticles(count) {
    const url = `${CONFIG.API_BASE}${CONFIG.API_PARAMS}&list=random&rnlimit=${count}&rnnamespace=0`;
    const data = await Wikipedia.fetch(url);
    return (data.query && data.query.random || []).map(m => m.title).filter(Boolean);
  },

  async searchArticles(topic) {
    const url = `${CONFIG.API_BASE}${CONFIG.API_PARAMS}&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=50&srnamespace=0`;
    const data = await Wikipedia.fetch(url);
    return (data.query && data.query.search || []).map(m => m.title).filter(Boolean);
  },

  async getExtracts(titles) {
    if (!titles.length) return {};
    const chunkSize = 20;
    const results = {};

    for (let i = 0; i < titles.length; i += chunkSize) {
      const chunk = titles.slice(i, i + chunkSize);
      const url = `${CONFIG.API_BASE}${CONFIG.API_PARAMS}&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(chunk.join('|'))}`;
      const data = await Wikipedia.fetch(url);
      const pages = data.query && data.query.pages || {};
      for (const id in pages) {
        if (id === '-1') continue;
        const page = pages[id];
        if (page.title && page.extract) {
          results[page.title] = page.extract;
        }
      }
    }
    return results;
  },

  createDescription(extract, title) {
    let desc = extract.trim();
    if (desc.toLowerCase().startsWith(title.toLowerCase())) {
      desc = desc.slice(title.length).trim();
    }
    desc = desc.replace(/^[,;:\s¿¡]+/, '');
    desc = desc.replace(/\s+/g, ' ');
    desc = Utils.truncate(desc, CONFIG.MAX_EXTRACT_LENGTH);
    if (desc.length < 15) return null;
    return desc;
  },

  async generateQuestions(mode, param, count) {
    let titles = [];

    if (mode === 'random') {
      titles = await Wikipedia.getRandomArticles(Math.max(count * 2, 30));
    } else if (mode === 'category') {
      titles = await Wikipedia.getCategoryArticles(param);
    } else if (mode === 'custom') {
      titles = await Wikipedia.searchArticles(param);
    }

    if (titles.length < 4) {
      throw new Error('No se encontraron suficientes artículos. Intenta con otro tema.');
    }

    Utils.shuffle(titles);
    titles = titles.slice(0, Math.max(count * 3, 30));

    const extracts = await Wikipedia.getExtracts(titles);

    const articles = [];
    for (const title of titles) {
      if (extracts[title]) {
        const desc = Wikipedia.createDescription(extracts[title], title);
        if (desc) {
          articles.push({ title, description: desc });
        }
      }
    }

    if (articles.length < 4) {
      throw new Error('No se pudieron generar suficientes preguntas. Intenta de nuevo.');
    }

    Utils.shuffle(articles);
    const questions = [];

    for (let i = 0; i < count && i + 3 < articles.length; i++) {
      const correct = articles[i];
      const incorrectPool = articles.slice(i + 1);
      if (incorrectPool.length < 3) break;

      const incorrect = incorrectPool.slice(0, 3).map(a => a.title);
      const options = [
        { text: correct.title, correct: true },
        ...incorrect.map(t => ({ text: t, correct: false }))
      ];
      Utils.shuffle(options);

      questions.push({
        description: correct.description,
        options: options.map((o, idx) => ({ ...o, letter: Utils.getAnswerLetter(idx) })),
        correctTitle: correct.title
      });
    }

    if (questions.length === 0) {
      throw new Error('No se pudieron generar preguntas. Intenta de nuevo.');
    }

    return questions;
  }
};

/* ==============================================
   SECCIÓN 6: MÓDULO DE JUEGO
   ============================================== */

const Game = {
  state: null,

  init() {
    Game.state = {
      mode: 'random',
      category: '',
      customTopic: '',
      totalQuestions: 20,
      difficulty: 'medium',
      currentQuestion: 0,
      questions: [],
      score: 0,
      lives: 3,
      coins: 0,
      streak: 0,
      maxStreak: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      timerEnabled: true,
      timePerQuestion: 15000,
      timerStart: 0,
      timerRemaining: 0,
      timerRunning: false,
      timerRAF: null,
      answered: false,
      helpsUsed: { '5050': false, hint: false, audience: false, freeze: 0 },
      gameOver: false
    };
  },

  startGame(config) {
    Game.init();
    const state = Game.state;
    state.mode = config.mode;
    state.category = config.category || '';
    state.customTopic = config.customTopic || '';
    state.totalQuestions = config.count;
    state.difficulty = config.difficulty;
    state.timerEnabled = config.timerEnabled !== false;
    state.timePerQuestion = CONFIG.DIFFICULTY[config.difficulty].time * 1000;
    state.questions = config.questions;
    state.currentQuestion = 0;
    state.score = 0;
    state.lives = 3;
    state.coins = Storage.getStats().coins || 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.correctAnswers = 0;
    state.incorrectAnswers = 0;
    state.helpsUsed = { '5050': false, hint: false, audience: false, freeze: 0 };

    UI.showPage('game-play');
    Game.showQuestion();
  },

  showQuestion() {
    const state = Game.state;
    if (state.currentQuestion >= state.questions.length) {
      if (state.totalQuestions === 0) {
        if (state.lives <= 0) { Game.endGame(); return; }
        Game.loadMoreQuestions();
        return;
      }
      Game.endGame();
      return;
    }

    if (state.lives <= 0) {
      Game.endGame();
      return;
    }

    state.answered = false;
    state.timePerQuestion = CONFIG.DIFFICULTY[state.difficulty].time * 1000;
    const q = state.questions[state.currentQuestion];
    state.timerStart = Date.now();

    UI.renderQuestion(q, state);

    const timerContainer = document.querySelector('.timer-container');
    if (state.timerEnabled) {
      timerContainer.style.display = 'block';
      Game.startTimer();
    } else {
      timerContainer.style.display = 'none';
      document.getElementById('timer-bar').style.width = '100%';
    }
  },

  startTimer() {
    const state = Game.state;
    if (!state.timerEnabled) return;
    const duration = state.timePerQuestion / 1000;
    state.timerRunning = true;
    state.timerStart = Date.now();
    const bar = document.getElementById('timer-bar');
    bar.style.width = '100%';
    bar.classList.remove('warning', 'danger');

    function tick() {
      if (!state.timerRunning) return;
      const elapsed = Date.now() - state.timerStart;
      state.timerRemaining = Math.max(0, state.timePerQuestion - elapsed);
      const pct = (state.timerRemaining / state.timePerQuestion) * 100;
      bar.style.width = pct + '%';
      bar.classList.toggle('warning', pct < 50 && pct >= 25);
      bar.classList.toggle('danger', pct < 25);

      if (pct <= 0) {
        Game.handleTimeUp();
        return;
      }
      state.timerRAF = requestAnimationFrame(tick);
    }
    state.timerRAF = requestAnimationFrame(tick);
  },

  stopTimer() {
    const state = Game.state;
    state.timerRunning = false;
    if (state.timerRAF) {
      cancelAnimationFrame(state.timerRAF);
      state.timerRAF = null;
    }
  },

  handleTimeUp() {
    const state = Game.state;
    if (state.answered) return;
    state.answered = true;
    Sound.play('timeout');
    state.lives--;
    state.incorrectAnswers++;
    state.streak = 0;
    UI.markCorrectAnswer();
    Game.updateLivesDisplay();

    setTimeout(() => {
      state.currentQuestion++;
      if (state.lives <= 0) {
        Game.endGame();
      } else {
        Game.showQuestion();
      }
    }, 1500);
  },

  selectAnswer(index) {
    const state = Game.state;
    if (state.answered) return;
    Game.stopTimer();
    state.answered = true;

    const q = state.questions[state.currentQuestion];
    const selected = q.options[index];
    const isCorrect = selected.correct;
    const elapsed = Date.now() - state.timerStart;
    const isFast = elapsed < state.timePerQuestion * 0.5;

    if (isCorrect) {
      state.score += CONFIG.BASE_SCORE;
      if (isFast) state.score += CONFIG.FAST_ANSWER_BONUS;
      state.correctAnswers++;
      state.streak++;
      if (state.streak > state.maxStreak) state.maxStreak = state.streak;

      state.coins += CONFIG.CORRECT_COINS;
      if (state.streak >= 3) state.coins += CONFIG.STREAK_COINS;

      if (state.streak === 3) state.score += CONFIG.STREAK_3.points;
      if (state.streak === 5) state.score += CONFIG.STREAK_5.points;
      if (state.streak === 10) state.score += CONFIG.STREAK_10.points;

      UI.markAnswer(index, true);
      Sound.play('correct');
      UI.showStreak(state.streak);
    } else {
      state.incorrectAnswers++;
      state.streak = 0;
      state.lives--;

      UI.markAnswer(index, false);
      Sound.play('incorrect');
      setTimeout(() => UI.markCorrectAnswer(), 600);
    }

    Game.updateLivesDisplay();
    UI.updateHeader();

    setTimeout(() => {
      state.currentQuestion++;
      if (state.lives <= 0) {
        Game.endGame();
      } else if (state.totalQuestions === 0 && state.currentQuestion >= state.questions.length) {
        Game.loadMoreQuestions();
      } else {
        Game.showQuestion();
      }
    }, isCorrect ? 1200 : 2000);
  },

  async loadMoreQuestions() {
    const state = Game.state;
    const questionArea = document.getElementById('question-area');
    questionArea.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <div class="loading-text">Cargando más preguntas...</div>
      </div>`;
    try {
      const newQuestions = await Game.fetchQuestions(state.mode, state.category || state.customTopic, CONFIG.PRELOAD_COUNT);
      state.questions = state.questions.concat(newQuestions);
      Game.showQuestion();
    } catch (err) {
      questionArea.innerHTML = `
        <div class="loading-screen">
          <div class="loading-text loading-error">Error al cargar más preguntas. Finalizando partida.</div>
        </div>`;
      setTimeout(() => Game.endGame(), 2000);
    }
  },

  async fetchQuestions(mode, param, count) {
    return await Wikipedia.generateQuestions(mode, param, count);
  },

  endGame() {
    const state = Game.state;
    Game.stopTimer();
    state.gameOver = true;

    const stats = Storage.getStats();
    stats.games++;
    stats.correct += state.correctAnswers;
    stats.incorrect += state.incorrectAnswers;
    if (state.score > stats.bestScore) stats.bestScore = state.score;
    stats.coins = state.coins;
    Storage.saveStats(stats);

    if (state.score > 0) {
      const modeName = state.mode === 'category' ? state.category :
                       state.mode === 'custom' ? state.customTopic : 'Aleatorio';
      Storage.addRanking('Jugador', state.score, modeName);
    }

    const newAchievements = Achievements.check(state);

    Sound.play('victory');
    UI.showGameOver(state, newAchievements);
  },

  useHelp(type) {
    const state = Game.state;
    if (state.answered) return;

    const cost = CONFIG.HELP_COSTS[type];
    if (state.coins < cost) {
      UI.showToast('¡Monedas insuficientes! Te faltan ' + (cost - state.coins) + ' 🪙', 'error');
      return;
    }

    if (type === 'freeze') {
      if (!state.timerEnabled) {
        UI.showToast('❄️ El temporizador está desactivado', 'error');
        return;
      }
      state.timerStart += 15000;
      state.coins -= cost;
      state.helpsUsed.freeze++;
      Sound.play('correct');
      UI.showToast('⏰ +15 segundos añadidos', 'info');
      UI.updateHeader();
      return;
    }

    if (type === '5050') {
      const q = state.questions[state.currentQuestion];
      const incorrectIndices = [];
      q.options.forEach((o, i) => {
        if (!o.correct) incorrectIndices.push(i);
      });
      Utils.shuffle(incorrectIndices);
      const toRemove = incorrectIndices.slice(0, 2);
      toRemove.forEach(i => {
        const btn = document.querySelectorAll('.answer-btn')[i];
        if (btn) btn.classList.add('removed');
      });
      state.coins -= cost;
      state.helpsUsed['5050'] = true;
      document.getElementById('help-5050').classList.add('used');
      Sound.play('correct');
      UI.showToast('✂️ 2 respuestas eliminadas', 'info');
      UI.updateHeader();
      return;
    }

    if (type === 'hint') {
      const q = state.questions[state.currentQuestion];
      const title = q.correctTitle;
      document.getElementById('hint-first-letter').textContent = title.charAt(0).toUpperCase();
      document.getElementById('hint-letter-count').textContent = `La palabra tiene ${title.length} letras`;
      document.getElementById('modal-hint').classList.add('active');
      state.coins -= cost;
      state.helpsUsed.hint = true;
      document.getElementById('help-hint').classList.add('used');
      UI.updateHeader();
      return;
    }

    if (type === 'audience') {
      const q = state.questions[state.currentQuestion];
      const correctIdx = q.options.findIndex(o => o.correct);
      const total = 100;
      const correctPct = Utils.rand(45, 75);
      let remaining = total - correctPct;
      const otherPcts = [];
      for (let i = 0; i < 3; i++) {
        if (i === 2) {
          otherPcts.push(remaining);
        } else {
          const p = Utils.rand(0, Math.floor(remaining / (3 - i)));
          otherPcts.push(p);
          remaining -= p;
        }
      }

      const bars = document.getElementById('audience-bars');
      bars.innerHTML = '';
      q.options.forEach((o, i) => {
        const pct = i === correctIdx ? correctPct : otherPcts.shift();
        const bar = document.createElement('div');
        bar.className = 'audience-option';
        bar.innerHTML = `
          <span class="option-label">${o.letter}</span>
          <div class="audience-bar-container">
            <div class="audience-bar-fill" style="width:0%">${pct}%</div>
          </div>`;
        bars.appendChild(bar);
        setTimeout(() => {
          const fill = bar.querySelector('.audience-bar-fill');
          fill.style.width = pct + '%';
        }, 100);
      });

      document.getElementById('modal-audience').classList.add('active');
      state.coins -= cost;
      state.helpsUsed.audience = true;
      document.getElementById('help-audience').classList.add('used');
      UI.updateHeader();
      return;
    }
  },

  updateLivesDisplay() {
    const state = Game.state;
    const container = document.getElementById('game-lives');
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement('span');
      heart.textContent = '❤️';
      if (i >= state.lives) heart.style.opacity = '0.2';
      container.appendChild(heart);
    }
  }
};

/* ==============================================
   SECCIÓN 7: MÓDULO DE LOGROS
   ============================================== */

const Achievements = {
  check(state) {
    const achievements = Storage.getAchievements();
    const stats = Storage.getStats();
    const newUnlocks = [];

    CONFIG.ACHIEVEMENTS.forEach(ach => {
      if (achievements[ach.id]) return;
      let unlock = false;

      switch (ach.id) {
        case 'first-correct':
          unlock = stats.correct >= 1 || state.correctAnswers >= 1;
          break;
        case '10-correct':
          unlock = stats.correct >= 10;
          break;
        case '50-correct':
          unlock = stats.correct >= 50;
          break;
        case 'history-master':
          unlock = state.mode === 'category' && state.category === 'Historia' && state.score > 0;
          break;
        case 'science-expert':
          unlock = state.mode === 'category' && state.category === 'Ciencia' && state.score > 0;
          break;
        case 'trivia-legend':
          unlock = state.score >= 1000;
          break;
        case 'streak-5':
          unlock = state.maxStreak >= 5;
          break;
      }

      if (unlock) {
        achievements[ach.id] = { unlockedAt: Utils.formatDate() };
        newUnlocks.push(ach);
      }
    });

    if (newUnlocks.length > 0) {
      Storage.saveAchievements(achievements);
    }

    return newUnlocks;
  },

  getAll() {
    const achievements = Storage.getAchievements();
    return CONFIG.ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: !!achievements[ach.id],
      unlockedAt: achievements[ach.id] ? achievements[ach.id].unlockedAt : null
    }));
  }
};

/* ==============================================
   SECCIÓN 8: MÓDULO DE INTERFAZ
   ============================================== */

const UI = {
  currentPage: 'home',

  init() {
    UI.bindNavButtons();
    UI.bindGameSetup();
    UI.bindGamePlay();
    UI.bindGameOver();
    UI.bindRanking();
    UI.bindSettings();
    UI.bindModals();
    UI.showPage('home');
    UI.updateHomeStats();
  },

  bindNavButtons() {
    Utils.$$('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page === 'game-setup') UI.setupGameConfig();
        UI.showPage(page);
      });
    });

    Utils.$$('.back-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.showPage(btn.dataset.page);
      });
    });
  },

  showPage(pageId) {
    Utils.$$('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) {
      page.classList.add('active');
      UI.currentPage = pageId;
    }

    if (pageId === 'ranking') UI.renderRanking();
    if (pageId === 'achievements') UI.renderAchievements();
    if (pageId === 'stats') UI.renderStats();
    if (pageId === 'home') UI.updateHomeStats();
    if (pageId === 'game-setup') UI.showPageSetupCoins();

    document.getElementById('offline-banner').classList.toggle('active', !navigator.onLine);
  },

  updateHomeStats() {
    const stats = Storage.getStats();
    document.getElementById('home-coins').textContent = stats.coins || 0;
    document.getElementById('home-best-score').textContent = stats.bestScore || 0;
  },

  showPageSetupCoins() {
    const stats = Storage.getStats();
    document.getElementById('setup-coins').textContent = stats.coins || 0;
  },

  bindGameSetup() {
    const modeCards = Utils.$$('.mode-card');
    modeCards.forEach(card => {
      card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const mode = card.dataset.mode;
        document.getElementById('setup-categories').style.display = mode === 'category' ? 'block' : 'none';
        document.getElementById('setup-custom').style.display = mode === 'custom' ? 'block' : 'none';
      });
    });

    Utils.$$('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Utils.$$('.category-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    Utils.$$('.setup-option[data-count]').forEach(btn => {
      btn.addEventListener('click', () => {
        Utils.$$('.setup-option[data-count]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    Utils.$$('.setup-option[data-difficulty]').forEach(btn => {
      btn.addEventListener('click', () => {
        Utils.$$('.setup-option[data-difficulty]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    document.getElementById('toggle-timer').addEventListener('click', function() {
      this.classList.toggle('active');
    });

    document.getElementById('btn-use-topic').addEventListener('click', () => {
      const input = document.getElementById('custom-topic');
      if (input.value.trim()) {
        UI.showToast('Tema: "' + input.value.trim() + '" seleccionado', 'info');
      }
    });

    document.getElementById('btn-start-game').addEventListener('click', () => UI.startGameSession());
  },

  async startGameSession() {
    const modeCard = document.querySelector('.mode-card.selected');
    const mode = modeCard.dataset.mode;
    const categoryBtn = document.querySelector('.category-btn.selected');
    const customTopic = document.getElementById('custom-topic').value.trim();
    const countBtn = document.querySelector('.setup-option.selected[data-count]');
    const diffBtn = document.querySelector('.setup-option.selected[data-difficulty]');

    const timerToggle = document.getElementById('toggle-timer');
    const timerEnabled = timerToggle.classList.contains('active');

    const config = {
      mode,
      category: mode === 'category' ? categoryBtn.dataset.category : '',
      customTopic: mode === 'custom' ? customTopic : '',
      count: parseInt(countBtn.dataset.count) || 20,
      difficulty: diffBtn.dataset.difficulty,
      timerEnabled
    };

    if (mode === 'custom' && !customTopic) {
      UI.showToast('✏️ Escribe un tema personalizado', 'error');
      return;
    }

    const playArea = document.getElementById('question-area');
    playArea.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <div class="loading-text">Consultando a Wikipedia... 🤔</div>
        <div class="loading-error" id="loading-error"></div>
      </div>`;

    UI.showPage('game-play');
    document.getElementById('question-counter').textContent = '...';
    document.getElementById('timer-bar').style.width = '0%';

    try {
      const param = mode === 'category' ? config.category : (mode === 'custom' ? customTopic : '');
      const questions = await Game.fetchQuestions(mode, param, config.count || CONFIG.PRELOAD_COUNT);
      config.questions = questions;
      Game.startGame(config);
    } catch (err) {
      const errorEl = document.getElementById('loading-error');
      if (errorEl) {
        errorEl.textContent = 'Error: ' + (err.message || 'No se pudieron cargar las preguntas. Verifica tu conexión.');
      } else {
        playArea.innerHTML = `
          <div class="loading-screen">
            <div class="loading-text loading-error">Error: ${err.message || 'No se pudieron cargar las preguntas'}</div>
            <button class="btn btn-primary btn-small" data-page="game-setup" style="margin-top:16px;">← Volver</button>
          </div>`;
        setTimeout(() => {
          const backBtn = playArea.querySelector('[data-page]');
          if (backBtn) backBtn.addEventListener('click', () => UI.showPage('game-setup'));
        }, 100);
      }
    }
  },

  renderQuestion(q, state) {
    const area = document.getElementById('question-area');
    const total = state.totalQuestions === 0 ? '∞' : state.questions.length;
    document.getElementById('question-counter').textContent = `${state.currentQuestion + 1}/${total}`;

    area.innerHTML = `
      ${state.streak >= 3 ? `<div class="streak-indicator">🔥 ¡Racha de ${state.streak}!</div>` : ''}
      <div class="question-text">¿A qué artículo pertenece esta descripción?</div>
      <div class="question-description">${Utils.escapeHtml(q.description)}</div>
      <div class="answers-grid">
        ${q.options.map((o, i) => `
          <button class="answer-btn" data-index="${i}" style="animation-delay:${i * 0.08}s">
            <span class="answer-letter">${o.letter}</span>
            <span>${Utils.escapeHtml(o.text)}</span>
          </button>
        `).join('')}
      </div>`;

    Utils.$$('.answer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Game.selectAnswer(parseInt(btn.dataset.index));
      });
    });

    document.getElementById('help-5050').classList.remove('used');
    document.getElementById('help-hint').classList.remove('used');
    document.getElementById('help-audience').classList.remove('used');

    UI.updateHeader();
    Game.updateLivesDisplay();
  },

  updateHeader() {
    const state = Game.state;
    document.getElementById('game-score').textContent = state.score;
    document.getElementById('game-coins').textContent = '🪙 ' + state.coins;
  },

  markAnswer(index, correct) {
    const btns = Utils.$$('.answer-btn');
    btns.forEach(b => b.disabled = true);
    const btn = btns[index];
    if (btn) {
      btn.classList.add(correct ? 'correct' : 'incorrect');
    }
  },

  markCorrectAnswer() {
    const q = Game.state.questions[Game.state.currentQuestion];
    const btns = Utils.$$('.answer-btn');
    btns.forEach(b => b.disabled = true);
    q.options.forEach((o, i) => {
      if (o.correct && btns[i]) {
        btns[i].classList.add('correct');
      }
    });
  },

  showStreak(streak) {
    if (streak === 3) UI.showToast('🔥 ¡Racha de 3! +100 puntos', 'success');
    if (streak === 5) UI.showToast('🔥 ¡Racha de 5! +250 puntos', 'success');
    if (streak === 10) UI.showToast('🔥 ¡Racha de 10! +500 puntos', 'success');
  },

  showGameOver(state, newAchievements) {
    const total = state.correctAnswers + state.incorrectAnswers;
    const accuracy = total > 0 ? Math.round((state.correctAnswers / total) * 100) : 0;

    document.getElementById('go-score').textContent = state.score + ' pts';
    document.getElementById('go-correct').textContent = state.correctAnswers;
    document.getElementById('go-incorrect').textContent = state.incorrectAnswers;
    document.getElementById('go-accuracy').textContent = accuracy + '%';

    if (state.score >= 1000) {
      document.getElementById('go-subtitle').textContent = '🏆 ¡Eres una leyenda de la trivia!';
    } else if (accuracy >= 80) {
      document.getElementById('go-subtitle').textContent = '🌟 ¡Excelente desempeño!';
    } else if (accuracy >= 60) {
      document.getElementById('go-subtitle').textContent = '👍 ¡Buen trabajo!';
    } else {
      document.getElementById('go-subtitle').textContent = '💪 ¡Sigue practicando!';
    }

    const achContainer = document.getElementById('go-achievements');
    achContainer.innerHTML = '';
    newAchievements.forEach((ach, i) => {
      const span = document.createElement('span');
      span.className = 'game-over-achievement';
      span.textContent = ach.icon;
      span.style.animationDelay = (0.5 + i * 0.2) + 's';
      achContainer.appendChild(span);
      setTimeout(() => Sound.play('achievement'), 500 + i * 200);
    });

    UI.showPage('game-over');
  },

  bindGamePlay() {
    document.getElementById('help-5050').addEventListener('click', () => Game.useHelp('5050'));
    document.getElementById('help-hint').addEventListener('click', () => Game.useHelp('hint'));
    document.getElementById('help-audience').addEventListener('click', () => Game.useHelp('audience'));
    document.getElementById('help-freeze').addEventListener('click', () => Game.useHelp('freeze'));
  },

  bindGameOver() {
    Utils.$$('#page-game-over [data-page]').forEach(btn => {
      btn.addEventListener('click', () => UI.showPage(btn.dataset.page));
    });
  },

  bindRanking() {
    document.getElementById('btn-clear-ranking').addEventListener('click', () => {
      if (confirm('¿Borrar todo el ranking?')) {
        Storage.saveRanking([]);
        UI.renderRanking();
      }
    });
  },

  setupGameConfig() {
    Utils.$$('.mode-card').forEach(c => c.classList.remove('selected'));
    document.querySelector('.mode-card[data-mode="random"]')?.classList.add('selected');
    Utils.$$('.category-btn').forEach(c => c.classList.remove('selected'));
    document.querySelector('.category-btn[data-category="Historia"]')?.classList.add('selected');
    Utils.$$('.setup-option[data-count]').forEach(c => c.classList.remove('selected'));
    document.querySelector('.setup-option[data-count="20"]')?.classList.add('selected');
    Utils.$$('.setup-option[data-difficulty]').forEach(c => c.classList.remove('selected'));
    document.querySelector('.setup-option[data-difficulty="medium"]')?.classList.add('selected');
    document.getElementById('setup-categories').style.display = 'none';
    document.getElementById('setup-custom').style.display = 'none';
    document.getElementById('custom-topic').value = '';
    document.getElementById('toggle-timer').classList.add('active');
    UI.showPageSetupCoins();
  },

  renderRanking() {
    const ranking = Storage.getRanking().slice(0, 10);
    const tbody = document.getElementById('ranking-body');
    const empty = document.getElementById('ranking-empty');

    tbody.innerHTML = '';
    if (ranking.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    ranking.forEach((entry, i) => {
      const tr = document.createElement('tr');
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      tr.innerHTML = `
        <td class="rank-num ${rankClass}">${i + 1}</td>
        <td>${Utils.escapeHtml(entry.name)}</td>
        <td style="font-weight:700;color:var(--accent-purple)">${entry.points}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(entry.category)}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${Utils.formatDateShort(entry.date)}</td>`;
      tbody.appendChild(tr);
    });
  },

  renderAchievements() {
    const all = Achievements.getAll();
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';
    all.forEach(ach => {
      const card = document.createElement('div');
      card.className = 'achievement-card' + (ach.unlocked ? '' : ' locked');
      card.innerHTML = `
        <span class="ach-icon">${ach.icon}</span>
        <span class="ach-name">${ach.unlocked ? ach.name : '???'}</span>
        <span class="ach-desc">${ach.unlocked ? ach.desc : 'Bloqueado'}</span>
        ${ach.unlocked && ach.unlockedAt ? `<span class="ach-date">${ach.unlockedAt}</span>` : ''}`;
      grid.appendChild(card);
    });
  },

  renderStats() {
    const stats = Storage.getStats();
    const total = stats.correct + stats.incorrect;
    const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

    document.getElementById('stat-games').textContent = stats.games;
    document.getElementById('stat-correct').textContent = stats.correct;
    document.getElementById('stat-incorrect').textContent = stats.incorrect;
    document.getElementById('stat-accuracy').textContent = accuracy + '%';
    document.getElementById('stat-best-score').textContent = stats.bestScore;
    document.getElementById('stat-coins').textContent = stats.coins;
  },

  bindSettings() {
    document.getElementById('toggle-sound').addEventListener('click', () => {
      const el = document.getElementById('toggle-sound');
      Sound.toggle();
      el.classList.toggle('active');
    });

    document.getElementById('btn-reset-data').addEventListener('click', () => {
      if (confirm('¿Estás seguro de borrar todos los datos? Esta acción no se puede deshacer.')) {
        Storage.resetAll();
        UI.updateHomeStats();
        UI.showToast('🗑️ Datos borrados correctamente', 'info');
      }
    });
  },

  bindModals() {
    document.getElementById('modal-5050-close').addEventListener('click', () => {
      document.getElementById('modal-5050').classList.remove('active');
    });
    document.getElementById('modal-hint-close').addEventListener('click', () => {
      document.getElementById('modal-hint').classList.remove('active');
    });
    document.getElementById('modal-audience-close').addEventListener('click', () => {
      document.getElementById('modal-audience').classList.remove('active');
    });
    document.getElementById('modal-ach-close').addEventListener('click', () => {
      document.getElementById('modal-achievement').classList.remove('active');
    });
    document.getElementById('modal-insufficient-close').addEventListener('click', () => {
      document.getElementById('modal-insufficient').classList.remove('active');
    });

    Utils.$$('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });
  },

  showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + (type || 'info') + ' active';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('active'), 2500);
  }
};

/* ==============================================
   SECCIÓN 9: MÓDULO PWA
   ============================================== */

const PWA = {
  deferredPrompt: null,
  isInstalled: false,

  init() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      PWA.isInstalled = true;
      return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      PWA.deferredPrompt = e;
      document.getElementById('install-banner').classList.add('active');
    });

    window.addEventListener('appinstalled', () => {
      PWA.isInstalled = true;
      PWA.deferredPrompt = null;
      document.getElementById('install-banner').classList.remove('active');
    });

    document.getElementById('btn-install').addEventListener('click', () => PWA.install());
    document.getElementById('btn-install-close').addEventListener('click', () => {
      document.getElementById('install-banner').classList.remove('active');
    });
  },

  async install() {
    if (!PWA.deferredPrompt) return;
    PWA.deferredPrompt.prompt();
    const result = await PWA.deferredPrompt.userChoice;
    PWA.deferredPrompt = null;
    document.getElementById('install-banner').classList.remove('active');
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  generateIcons() {
    const sizes = [72, 96, 128, 192, 256, 512];
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;

    Promise.all(sizes.map(size => {
      return new Promise(resolve => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#6C63FF');
        grad.addColorStop(1, '#FF6584');
        ctx.fillStyle = grad;
        (function roundRect(ctx, x, y, w, h, r) {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
        })(ctx, 0, 0, size, size, size * 0.2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${size * 0.35}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const sparkleSize = size * 0.12;
        ctx.font = `${sparkleSize}px Arial, sans-serif`;
        ctx.fillText('✨', size * 0.75, size * 0.25);
        ctx.font = `bold ${size * 0.35}px Arial, sans-serif`;
        ctx.fillText('TMW', size / 2, size / 2);

        canvas.toBlob(blob => {
          resolve({ src: URL.createObjectURL(blob), sizes: `${size}x${size}`, type: 'image/png' });
        }, 'image/png');
      });
    })).then(icons => {
      const manifest = {
        name: 'Trivia Master Wiki',
        short_name: 'TriviaWiki',
        description: 'Juego de trivia basado en Wikipedia en español',
        start_url: './index.html',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f0f23',
        background_color: '#0f0f23',
        lang: 'es',
        scope: './',
        icons
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      manifestLink.href = URL.createObjectURL(blob);
    });
  }
};

/* ==============================================
   SECCIÓN 10: INICIALIZACIÓN
   ============================================== */

document.addEventListener('DOMContentLoaded', () => {
  Storage.init();
  Sound.init();
  UI.init();
  PWA.init();
  PWA.registerSW();
  PWA.generateIcons();

  window.addEventListener('online', () => {
    document.getElementById('offline-banner').classList.remove('active');
  });

  window.addEventListener('offline', () => {
    document.getElementById('offline-banner').classList.add('active');
  });
});
