/**
 * LYCAN — Système de Bots IA
 * ============================================================
 * Intégration dans game.html :
 *   <script src="bots.js"></script>
 *   puis appelle LycanBots.init(gameInstance) une fois la partie créée.
 *
 * EDGE FUNCTION URL : remplace EDGE_FUNCTION_URL par ton URL Supabase.
 * Ex: https://sicyjahkxijkxrxtmjhl.supabase.co/functions/v1/bot-action
 * ============================================================
 */

const LycanBots = (() => {

  // ─── CONFIG ──────────────────────────────────────────────────────────────
  const EDGE_FUNCTION_URL = "https://sicyjahkxijkxrxtmjhl.supabase.co/functions/v1/bot-action";
  const SUPABASE_ANON_KEY = "sb_publishable_5s9soZN5O0Mp4nuWHlXXYA_Xv979vZj";

  const MAX_BOTS = 17;

  // Délais en ms pour simuler un comportement humain
  const TYPING_DELAY_MIN = 1800;
  const TYPING_DELAY_MAX = 5500;
  const ACTION_DELAY_MIN = 3000;
  const ACTION_DELAY_MAX = 9000;

  // ─── DONNÉES DES BOTS ────────────────────────────────────────────────────

  const BOT_NAMES = [
    "LoupSombre", "VilleneuveHugo", "NocturneClair", "FenrirLeGrand",
    "MidnightRose", "SeleneDeNuit", "GarouSilencieux", "OdysseeNoire",
    "LunaireFred", "CrepusculeVif", "ThornWatcher", "CendreEtSang",
    "LesombresEaux", "VespereBlanche", "GallouxLouis", "NuitProfonde",
    "AuroreMorte",
  ];

  const BOT_AVATARS = ["🐺","🦅","🦉","🐦‍⚫","🦇","🌙","⭐","🔥","❄️","🌑","💀","🗡️","🛡️","🌿","🐍","🦁","🐉"];

  const PERSONALITIES = ["prudent","agressif","suspicieux","discret","leader","naif","analyste"];

  // Rôles du jeu et leur distribution recommandée
  const ROLE_DISTRIBUTION: Record<number, string[]> = {
    4:  ["Loup-Garou", "Villageois", "Villageois", "Voyante"],
    5:  ["Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Voyante"],
    6:  ["Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Voyante", "Sorcière"],
    7:  ["Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Villageois", "Voyante", "Sorcière"],
    8:  ["Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Villageois", "Voyante", "Sorcière", "Chasseur"],
    9:  ["Loup-Garou", "Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Villageois", "Voyante", "Sorcière", "Chasseur"],
    10: ["Loup-Garou", "Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Villageois", "Villageois", "Voyante", "Sorcière", "Chasseur"],
    12: ["Loup-Garou", "Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Villageois", "Villageois", "Villageois", "Voyante", "Sorcière", "Chasseur", "Cupidon"],
    15: ["Loup-Garou", "Loup-Garou", "Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Villageois", "Villageois", "Villageois", "Villageois", "Voyante", "Sorcière", "Chasseur", "Cupidon", "Villageois"],
    17: ["Loup-Garou", "Loup-Garou", "Loup-Garou", "Loup-Garou", "Loup-Garou", "Villageois", "Villageois", "Villageois", "Villageois", "Villageois", "Villageois", "Villageois", "Voyante", "Sorcière", "Chasseur", "Cupidon", "Villageois"],
  };

  // Messages de discussion par défaut (fallback si API indisponible)
  const FALLBACK_MESSAGES: Record<string, string[]> = {
    day: [
      "Je surveille tout le monde... quelqu'un se comporte bizarrement.",
      "Hmm, {target} n'a pas dit grand chose depuis le début. Suspect ?",
      "Je vote pour {target}, son comportement est louche.",
      "Attendons d'avoir plus d'infos avant de voter.",
      "Moi je fais confiance à {target} pour l'instant.",
      "Les loups essaient de se faire oublier. Qui n'a pas parlé ?",
      "Quelqu'un a des infos sur la nuit dernière ?",
      "Je ne suis pas convaincu par les arguments de {target}.",
      "Cette nuit a été dure... restons soudés.",
      "Je vote {target} — trop calme pour être honnête.",
    ],
    night: [
      "(chuchote) On vise {target} cette nuit.",
      "(pense) Je dois rester discret...",
      "(observe) Je surveille les réactions demain.",
    ],
    accusation: [
      "{target} ment depuis le début !",
      "Regardez comment {target} défend les loups... c'est suspect.",
      "J'accuse {target}, j'en suis presque sûr.",
      "Mon instinct me dit que {target} n'est pas clean.",
    ],
    defense: [
      "Je suis innocent, faites-moi confiance !",
      "Pourquoi vous m'accusez moi ? Regardez plutôt {target} !",
      "J'ai des infos importantes mais je ne peux pas tout dire...",
    ],
  };

  // ─── ÉTAT INTERNE ────────────────────────────────────────────────────────
  let _game: any = null;
  let _bots: Bot[] = [];
  let _botMessages: Record<string, string[]> = {};
  let _actionTimers: ReturnType<typeof setTimeout>[] = [];
  let _isRunning = false;

  interface Bot {
    id: string;
    name: string;
    avatar: string;
    role: string;
    personality: string;
    isAlive: boolean;
    isBot: true;
    suspicions: string[];   // IDs des joueurs suspectés
    trusts: string[];       // IDs des joueurs de confiance
    voteTarget: string | null;
  }

  // ─── API PUBLIQUE ─────────────────────────────────────────────────────────

  /**
   * Initialise le système de bots.
   * @param game Objet partage (géré par ton game.html) avec :
   *   - game.players       : joueurs humains déjà dans la partie
   *   - game.addPlayer(bot): ajoute un bot comme joueur
   *   - game.removePlayer(id): retire un joueur
   *   - game.getState()    : retourne l'état actuel de la partie
   *   - game.onPhaseChange(cb): callback appelé quand la phase change
   *   - game.sendMessage(botId, text): envoie un message dans le chat
   *   - game.castVote(botId, targetId): vote pour éliminer
   *   - game.nightAction(botId, targetId): action nocturne
   */
  function init(game: any) {
    _game = game;
    _bots = [];
    _botMessages = {};
    console.log("[LycanBots] Système initialisé.");
  }

  /**
   * Crée N bots et les ajoute à la partie.
   * @param count Nombre de bots (1 à 17)
   * @param existingCount Nombre de joueurs humains déjà présents
   */
  function addBots(count: number, existingCount: number = 0) {
    if (!_game) { console.error("[LycanBots] Appelle init() d'abord."); return []; }
    count = Math.min(count, MAX_BOTS - existingCount);
    if (count <= 0) return [];

    const totalPlayers = existingCount + count;
    const roles = getRoleDistribution(totalPlayers);

    // On attribue les rôles aux bots (les humains ont déjà leurs rôles)
    const botRoles = roles.slice(existingCount);

    const newBots: Bot[] = [];
    const usedNames = new Set((_game.players || []).map((p: any) => p.name));

    for (let i = 0; i < count; i++) {
      const name = getUniqueName(usedNames);
      usedNames.add(name);

      const bot: Bot = {
        id: `bot_${Date.now()}_${i}`,
        name,
        avatar: BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)],
        role: botRoles[i] || "Villageois",
        personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
        isAlive: true,
        isBot: true,
        suspicions: [],
        trusts: [],
        voteTarget: null,
      };

      _bots.push(bot);
      _botMessages[bot.id] = [];
      newBots.push(bot);

      // Intégration dans le système de jeu
      if (_game.addPlayer) _game.addPlayer(bot);
    }

    console.log(`[LycanBots] ${count} bots créés :`, newBots.map(b => `${b.name}(${b.role})`).join(", "));
    return newBots;
  }

  /**
   * Démarre la boucle d'actions des bots pour la phase actuelle.
   */
  function startPhase() {
    if (!_game || !_isRunning) return;
    const state = _game.getState?.() || {};

    _bots.filter(b => b.isAlive).forEach((bot, i) => {
      const delay = randomBetween(
        state.phase === "day" ? TYPING_DELAY_MIN : ACTION_DELAY_MIN,
        state.phase === "day" ? TYPING_DELAY_MAX : ACTION_DELAY_MAX
      ) + i * 1200; // Décalage pour éviter que tous parlent en même temps

      const timer = setTimeout(() => executeBotTurn(bot, state), delay);
      _actionTimers.push(timer);
    });
  }

  /**
   * Active / désactive les bots.
   */
  function setRunning(active: boolean) {
    _isRunning = active;
    if (!active) {
      _actionTimers.forEach(t => clearTimeout(t));
      _actionTimers = [];
    }
  }

  /**
   * Marque un bot comme mort.
   */
  function killBot(botId: string) {
    const bot = _bots.find(b => b.id === botId);
    if (bot) bot.isAlive = false;
  }

  /**
   * Retourne la liste des bots actifs.
   */
  function getBots() { return [..._bots]; }

  /**
   * Retourne un bot par son ID.
   */
  function getBot(id: string) { return _bots.find(b => b.id === id); }

  /**
   * Supprime tous les bots (fin de partie ou reset).
   */
  function clearBots() {
    setRunning(false);
    _bots.forEach(b => { if (_game?.removePlayer) _game.removePlayer(b.id); });
    _bots = [];
    _botMessages = {};
  }

  // ─── LOGIQUE INTERNE ──────────────────────────────────────────────────────

  async function executeBotTurn(bot: Bot, state: any) {
    try {
      const result = await callEdgeFunction(bot, state);
      applyBotAction(bot, result, state);
    } catch (err) {
      console.warn(`[LycanBots] API indisponible pour ${bot.name}, utilisation du fallback.`);
      applyFallbackAction(bot, state);
    }
  }

  async function callEdgeFunction(bot: Bot, gameState: any): Promise<any> {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ bot, gameState }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  function applyBotAction(bot: Bot, result: any, state: any) {
    if (!result) return;

    // 1. Envoyer le message dans le chat
    if (result.message && result.message !== "null") {
      _botMessages[bot.id].push(result.message);
      if (_game?.sendMessage) {
        _game.sendMessage(bot.id, result.message);
      }
    }

    // 2. Appliquer l'action
    switch (result.action) {
      case "vote":
        if (result.targetId) {
          bot.voteTarget = result.targetId;
          if (_game?.castVote) _game.castVote(bot.id, result.targetId);
        }
        break;

      case "accuse":
        if (result.targetId && !bot.suspicions.includes(result.targetId)) {
          bot.suspicions.push(result.targetId);
        }
        break;

      case "suspect":
        if (result.targetId) bot.suspicions.push(result.targetId);
        break;

      case "defend":
        if (result.targetId && !bot.trusts.includes(result.targetId)) {
          bot.trusts.push(result.targetId);
        }
        break;

      case "night_kill":
      case "night_action":
        if (result.targetId && _game?.nightAction) {
          _game.nightAction(bot.id, result.targetId);
        }
        break;
    }

    console.log(`[LycanBots] ${bot.name} (${bot.role}): "${result.message}" → action: ${result.action} sur ${result.targetName || "—"}`);
  }

  function applyFallbackAction(bot: Bot, state: any) {
    const alivePlayers = (state.alivePlayers || []).filter((p: any) => p.id !== bot.id);
    if (!alivePlayers.length) return;

    const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const phase = state.phase || "day";

    // Choisir un type de message selon la personnalité
    let pool: string[];
    if (bot.personality === "agressif" || bot.personality === "suspicieux") {
      pool = FALLBACK_MESSAGES.accusation;
    } else if (bot.personality === "naif" || bot.personality === "discret") {
      pool = FALLBACK_MESSAGES.day;
    } else {
      pool = phase === "day" ? FALLBACK_MESSAGES.day : FALLBACK_MESSAGES.night;
    }

    const template = pool[Math.floor(Math.random() * pool.length)];
    const message = template.replace("{target}", randomTarget.name);

    _botMessages[bot.id].push(message);
    if (_game?.sendMessage) _game.sendMessage(bot.id, message);

    // Vote aléatoire en journée
    if (phase === "day" && Math.random() > 0.5) {
      bot.voteTarget = randomTarget.id;
      if (_game?.castVote) _game.castVote(bot.id, randomTarget.id);
    }
  }

  // ─── UTILITAIRES ─────────────────────────────────────────────────────────

  function getRoleDistribution(total: number): string[] {
    // Trouver la distribution la plus proche
    const keys = Object.keys(ROLE_DISTRIBUTION).map(Number).sort((a, b) => a - b);
    let best = keys[0];
    for (const k of keys) { if (k <= total) best = k; }
    const base = [...ROLE_DISTRIBUTION[best]];

    // Compléter avec des villageois si nécessaire
    while (base.length < total) base.push("Villageois");
    return shuffle(base).slice(0, total);
  }

  function getUniqueName(used: Set<string>): string {
    const available = BOT_NAMES.filter(n => !used.has(n));
    if (available.length) return available[Math.floor(Math.random() * available.length)];
    return "Inconnu" + Math.floor(Math.random() * 999);
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ─── INTERFACE POUR PARTIE PRIVÉE ────────────────────────────────────────

  /**
   * Génère l'UI du sélecteur de bots pour une salle privée.
   * Injecte dans l'élément dont l'ID est passé en paramètre.
   * @param containerId ID de l'élément HTML conteneur
   * @param currentPlayers Nombre de joueurs humains actuels
   * @param onAdd Callback(nbBots) appelé quand l'hôte valide
   */
  function renderBotSelector(containerId: string, currentPlayers: number, onAdd: (n: number) => void) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const max = Math.min(MAX_BOTS - currentPlayers, 16);
    if (max <= 0) {
      el.innerHTML = `<p style="font-family:'Cinzel',serif;font-size:.7rem;color:var(--text-dim)">Salle pleine — aucun bot possible.</p>`;
      return;
    }

    el.innerHTML = `
      <div style="background:linear-gradient(160deg,rgba(8,13,26,.97),rgba(11,18,40,.95));border:1px solid rgba(74,111,165,.25);padding:1.5rem;position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(to right,transparent,#4a6fa5,transparent)"></div>
        <div style="font-family:'Cinzel Decorative',serif;font-size:.9rem;color:#d4e0f0;margin-bottom:1rem;letter-spacing:.15em;">🤖 Ajouter des Bots IA</div>
        <div style="font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:#5a7080;margin-bottom:.8rem;">
          Disponibles : 0 – ${max} bots
        </div>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.2rem;">
          <button onclick="LycanBots._adjustBots(-1)" style="width:36px;height:36px;background:rgba(74,111,165,.15);border:1px solid rgba(74,111,165,.3);color:#d4e0f0;font-size:1.2rem;cursor:pointer;font-family:'Cinzel',serif;">−</button>
          <div style="font-family:'Cinzel Decorative',serif;font-size:1.6rem;color:#d4e0f0;min-width:40px;text-align:center;" id="botCountDisplay">0</div>
          <button onclick="LycanBots._adjustBots(1)" style="width:36px;height:36px;background:rgba(74,111,165,.15);border:1px solid rgba(74,111,165,.3);color:#d4e0f0;font-size:1.2rem;cursor:pointer;font-family:'Cinzel',serif;">+</button>
          <div style="font-family:'Cinzel',serif;font-size:.65rem;color:#5a7080;letter-spacing:.1em;">/ ${max} max</div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;" id="botPreviewNames"></div>
        <button onclick="LycanBots._confirmBots(${currentPlayers})" style="font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:.2em;padding:.8rem 2rem;border:none;cursor:pointer;background:linear-gradient(135deg,#1a3a6e,#4a6fa5);color:#d4e0f0;clip-path:polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%);transition:all .3s;">
          🐺 Confirmer les bots
        </button>
        <div style="font-family:'Cinzel',serif;font-size:.6rem;color:#5a7080;margin-top:.8rem;line-height:1.6;">
          Les bots jouent grâce à l'IA Claude. Ils discutent, accusent et votent de façon autonome.<br/>
          Disponible uniquement en partie privée.
        </div>
      </div>`;

    // Stockage temporaire du callback
    (window as any)._botOnAdd = onAdd;
    (window as any)._botCount = 0;
    (window as any)._botMax = max;
  }

  // Fonctions appelées depuis l'UI (attachées à window via _expose)
  function _adjustBots(delta: number) {
    const max = (window as any)._botMax || 0;
    let n = ((window as any)._botCount || 0) + delta;
    n = Math.max(0, Math.min(max, n));
    (window as any)._botCount = n;

    const display = document.getElementById("botCountDisplay");
    if (display) display.textContent = String(n);

    // Aperçu des noms
    const preview = document.getElementById("botPreviewNames");
    if (preview) {
      preview.innerHTML = BOT_NAMES.slice(0, n).map(name =>
        `<span style="background:rgba(74,111,165,.15);border:1px solid rgba(74,111,165,.25);font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:.1em;padding:.2rem .6rem;color:#a8b8d0;">🐺 ${name}</span>`
      ).join("");
    }
  }

  function _confirmBots(currentPlayers: number) {
    const n = (window as any)._botCount || 0;
    if (n === 0) return;
    const cb = (window as any)._botOnAdd;
    if (cb) cb(n);
  }

  // Expose les fonctions UI sur window
  function _expose() {
    (window as any).LycanBots = {
      init, addBots, startPhase, setRunning, killBot, getBots, getBot, clearBots,
      renderBotSelector, _adjustBots, _confirmBots,
    };
  }

  _expose();

  return { init, addBots, startPhase, setRunning, killBot, getBots, getBot, clearBots, renderBotSelector, _adjustBots, _confirmBots };

})();

// ─── EXEMPLE D'INTÉGRATION dans game.html ────────────────────────────────────
/*

// 1. Dans ton HTML, inclure le script :
//    <script src="bots.js"></script>

// 2. Créer l'adaptateur entre LycanBots et ton système de jeu :

const gameAdapter = {
  players: currentPlayers,   // tableau de joueurs humains

  addPlayer(bot) {
    // Ajoute le bot à ta liste de joueurs et affiche-le dans le lobby
    currentPlayers.push(bot);
    renderPlayerList();
  },

  removePlayer(id) {
    currentPlayers = currentPlayers.filter(p => p.id !== id);
    renderPlayerList();
  },

  getState() {
    return {
      phase: currentPhase,          // "day" ou "night"
      day: currentDay,              // numéro du jour
      alivePlayers: alivePlayers,   // [{id, name, role?}]
      deadPlayers: deadPlayers,     // [{id, name, role}]
      chatHistory: chatMessages,    // [{author, text}]
      suspicions: suspicions,       // [{suspect, by}]
      votes: votes,                 // [{voter, target}]
    };
  },

  sendMessage(botId, text) {
    const bot = LycanBots.getBot(botId);
    addChatMessage({ author: bot.name, text, isBot: true, avatar: bot.avatar });
  },

  castVote(botId, targetId) {
    registerVote(botId, targetId);
    updateVoteDisplay();
  },

  nightAction(botId, targetId) {
    const bot = LycanBots.getBot(botId);
    if (bot.role === "Loup-Garou") registerKillTarget(botId, targetId);
    else if (bot.role === "Voyante") revealRole(botId, targetId);
    // etc.
  },

  onPhaseChange(callback) {
    phaseChangeListeners.push(callback);
  }
};

// 3. Initialiser et ajouter les bots (bouton dans le lobby de partie privée) :
LycanBots.init(gameAdapter);

// 4. Afficher le sélecteur de bots dans le lobby privé :
LycanBots.renderBotSelector("botSelectorContainer", currentPlayers.length, (nbBots) => {
  const newBots = LycanBots.addBots(nbBots, currentPlayers.length);
  console.log("Bots ajoutés:", newBots.length);
});

// 5. Quand la partie commence :
LycanBots.setRunning(true);

// 6. Quand la phase change (jour <-> nuit) :
LycanBots.startPhase();

// 7. Quand un bot meurt :
LycanBots.killBot(botId);

// 8. Fin de partie :
LycanBots.clearBots();

*/
